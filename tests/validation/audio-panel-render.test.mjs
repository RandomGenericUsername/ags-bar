#!/usr/bin/env node
// Render gate for the redesigned audio panel.
//
// Added 2026-10-03 after the first implementation pass shipped a popup that
// rendered no controls at all. Every other gate in this change stayed green
// through that: the domain, adapter, and presentation suites all pass because
// they exercise modules directly, and `ags bundle` compiles an unwired popup
// without complaint. Nothing asked the only question that mattered -- does the
// panel actually show its body?
//
// This gate answers it statically, from the source, so it runs in CI without
// a display server. It asserts the composition root is wired, not that a
// particular widget tree was instantiated:
//
//   1. app.tsx passes a binding to AudioPopup (it did not).
//   2. AudioPopup's `binding` parameter is required (it was optional).
//   3. The "Audio controls are connecting" fallback is gone (it masked the
//      defect by rendering a plausible loading state forever).
//   4. audio-panel.css is actually imported by something (it was not).
//   5. Nothing outside the new boundary still imports ./state (the second
//      global audio model design.md forbids).
//   6. The new layers are reachable from app.tsx rather than orphaned.
//
// Static only. A green run means the panel is wired, not that it looks right --
// that is 7.7's live smoke and 7.8/7.9's visual review.

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const AGS = resolve(HERE, "../..");
const AUDIO = join(AGS, "audio");

const read = (p) => readFileSync(p, "utf8");

/**
 * Strip comments before scanning.
 *
 * A check like "the connecting fallback is gone" must not be satisfied or
 * defeated by prose about it: AudioPopup.tsx documents that the placeholder
 * existed and why, in a comment. Scanning raw text made that documentation read
 * as the defect it describes. Block and line comments are removed; string
 * literals are left alone, since the placeholder ships inside one.
 */
function stripComments(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === "/*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (two === "//") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
      continue;
    }
    out += text[i];
  }
  return out;
}

const appTsx = stripComments(read(join(AGS, "app.tsx")));
const popupSrc = stripComments(read(join(AUDIO, "AudioPopup.tsx")));
const styleSrc = existsSync(join(AGS, "style.css")) ? read(join(AGS, "style.css")) : "";

const checks = [];
const check = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (err) {
    checks.push({ name, ok: false, err });
  }
};

const grep = (needle, path) => {
  try {
    return read(path).includes(needle);
  } catch {
    return false;
  }
};

check("app.tsx passes a binding to AudioPopup", () => {
  const call = appTsx.match(/AudioPopup\([^)]*\)/);
  assert.ok(call, "no AudioPopup(...) call found in app.tsx");
  assert.match(
    call[0],
    /AudioPopup\(\s*[^,()]+,\s*[A-Za-z_$][\w$]*\s*\)/,
    `AudioPopup is called with no binding: ${call[0]}. The panel renders nothing.`
  );
});

check("AudioPopup's binding parameter is required", () => {
  const sig = popupSrc.match(/export function AudioPopup\(([^)]*)\)/);
  assert.ok(sig, "AudioPopup signature not found");
  assert.ok(
    !/binding\?\s*:/.test(sig[1]),
    `binding is optional in AudioPopup(${sig[1]}). Make it required so an ` +
      "unwired panel is a typecheck error instead of a silent empty state."
  );
});

check('the "Audio controls are connecting" fallback is removed', () => {
  assert.ok(
    !popupSrc.includes("Audio controls are connecting"),
    "AudioPopup still renders the connecting fallback; an unwired panel is " +
      "indistinguishable from a starting one."
  );
  assert.ok(
    !/binding\s*\?/.test(popupSrc),
    "AudioPopup still branches on binding presence; it must render " +
      "AudioPanelContent unconditionally."
  );
});

check("audio-panel.css is imported by the AGS stylesheet", () => {
  const referenced =
    grep("audio-panel.css", join(AGS, "style.css")) ||
    grep("audio-panel.css", join(AGS, "app.tsx")) ||
    grep("audio-panel.css", popupSrc);
  assert.ok(
    referenced,
    "audio-panel.css is imported by nothing, so the approved sound stylesheet " +
      "is dead and the popup falls back to pre-existing .audio-* rules."
  );
  assert.ok(styleSrc.length > 0, "style.css could not be read");
});

check("no consumer outside the new boundary imports ./state", () => {
  // app.tsx, bar widgets, and settings-panel are the real consumers. Modules
  // inside audio/ may still reference it mid-migration; task 6.0f retires it.
  const consumers = [
    join(AGS, "app.tsx"),
    join(AGS, "bar/widgets/audio.tsx"),
    join(AGS, "settings-panel/settings.tsx"),
  ];
  const offenders = consumers.filter((p) => existsSync(p) && grep('from "./state"', p));
  assert.deepEqual(
    offenders,
    [],
    `these consumers still read the old state.ts model: ${offenders.join(", ")}`
  );
});

check("the new boundary is reachable from app.tsx", () => {
  // Reachability, not a literal import in app.tsx: the composition root is
  // expected to assemble the layers, so follow the import graph transitively
  // from app.tsx rather than demanding app.tsx name each one.
  const seen = new Set();
  const queue = [join(AGS, "app.tsx")];
  const LAYERS = [
    "audio/domain/audio-model.ts",
    "audio/application/ports.ts",
    "audio/application/audio-actions.ts",
    "audio/application/runtime/audio-session-runtime.ts",
    "audio/adapters/pipewire/pipewire-observation.ts",
    "audio/adapters/mpris/mpris-adapter.ts",
    "audio/presentation/audio-panel-view-model.ts",
  ];
  const IMPORT_RE = /from\s+["']([^"']+)["']/g;
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const src = stripComments(read(file));
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue; // ags/, gi://, node builtins
      // Extensionless relative imports, as AGS/GJS writes them.
      const base = resolve(dirname(file), spec);
      const target = existsSync(base)
        ? base
        : [base + ".ts", base + ".tsx", join(base, "index.ts")].find((c) =>
            existsSync(c)
          );
      if (target) queue.push(target);
    }
  }
  const missing = LAYERS.filter(
    (rel) => !seen.has(join(AGS, rel))
  );
  assert.deepEqual(
    missing,
    [],
    `unreachable from app.tsx: ${missing.join(", ")}. These modules exist but ` +
      "nothing imports them, so the panel has no data source -- orphaned " +
      "architecture that compiles and renders nothing."
  );
});

check("the sound surfaces stay on surface.panel (doc 113 W-10)", () => {
  // The popover, tray dropdown and settings popover are AGS layer-shell
  // overlays. `surface.window` is the rofi/wlogout/GTK toplevel role and must
  // not appear in this app's sound surface or its stylesheet.
  const files = [
    join(AUDIO, "AudioPopup.tsx"),
    join(AUDIO, "TrayPopup.tsx"),
    join(AUDIO, "audio-panel.css"),
    join(AUDIO, "ui/controls.tsx"),
    join(AGS, "bar/widgets/media.tsx"),
    join(AGS, "settings/glib-store.ts"),
  ];
  const offenders = files.filter((p) => stripComments(read(p)).includes("surface.window"));
  assert.deepEqual(offenders, [], `surface.window is used in: ${offenders.join(", ")}`);
});

check("the tray dropdown is a registered overlay with catcher + panel windows", () => {
  const app = read(join(AGS, "app.tsx"));
  assert.match(app, /TrayPopupCatcher\(primary\)/, "no tray catcher window in app.tsx");
  assert.match(app, /TrayPopup\(primary,\s*\w+\)/, "no tray dropdown window in app.tsx");
  const reg = read(join(AGS, "overlays.ts"));
  assert.match(reg, /id:\s*"tray"/, "the tray dropdown is not registered with the overlay coordinator");
  const stateSrc = read(join(AUDIO, "panel-state.ts"));
  assert.match(stateSrc, /trayPopupVisible/, "the shared tray visibility accessor is missing");
  assert.match(stateSrc, /mediaWidgetEnabled/, "the tray ignores the Bar media widget setting");
});

check("the media strip is declared, placed and rendered", () => {
  const manifest = read(join(AGS, "bar/bar-manifest.ts"));
  assert.match(manifest, /id:\s*"media-strip"/, "bar-manifest has no media-strip capability");
  const layout = read(join(AGS, "bar/layout.default.ts"));
  const end = layout.slice(layout.indexOf("end: ["));
  const stripAt = end.indexOf('{ id: "media-strip" }');
  const trayAt = end.indexOf('{ id: "tray" }');
  assert.ok(stripAt >= 0, "the default layout does not place media-strip");
  assert.ok(trayAt > stripAt, "media-strip must sit before the tray slot");
  const registry = read(join(AGS, "bar/registry.ts"));
  assert.match(registry, /widgets\.set\("media-strip"/, "the registry does not render media-strip");
  const widget = read(join(AGS, "bar/widgets/media.tsx"));
  assert.match(widget, /mediaWidgetEnabled\(\)\s*&&\s*playingRows\(model\)\.length > 0/,
    "the strip is not gated on the setting plus a current player");
});

check("the settings file is app-owned and never the AGS link", () => {
  const store = read(join(AGS, "settings/glib-store.ts"));
  assert.match(store, /get_user_config_dir\(\)/, "the store does not resolve $XDG_CONFIG_HOME");
  assert.match(store, /SETTINGS_RELATIVE_PATH/, "the store bypasses the domain path constant");
  const domain = read(join(AGS, "settings/domain.ts"));
  assert.match(domain, /"ags-bar\/config\.json"/, "the app-owned path is not ags-bar/config.json");
  assert.ok(!domain.includes('"ags/config.json"'), "the AGS install link is not writable state");
  assert.ok(!store.includes("clipboard"), "the bar must not write the clipboard config");
});

check("audio-panel.css introduces no new literal chrome colour", () => {
  const css = read(join(AUDIO, "audio-panel.css"));
  const literals = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
  // The live/playing dot is the one sanctioned semantic-signal green (the
  // paper: green is a state signal, not a palette role). Everything else must
  // be a palette role or alpha(@role, n).
  const offenders = literals.filter((value) => value !== "#4ade80");
  assert.deepEqual(offenders, [], `literal colours in the sound stylesheet: ${offenders.join(", ")}`);
  assert.ok(!/\brgba?\(/.test(css), "the sound stylesheet uses an rgb()/rgba() literal");
});

check("the persistent hero is outside the scroll area and the deck is complete", () => {
  const src = popupSrc;
  const hero = src.indexOf('class="audio-hero"');
  const scroll = src.indexOf("<scrolledwindow");
  assert.ok(hero >= 0 && scroll > hero, "the Output hero must precede (and live outside) the scroller");
  for (const marker of ['label="Playing"', 'label="Mixer"', 'audio-input-section', 'class="audio-foot"']) {
    assert.ok(src.includes(marker), `the sound surface is missing ${marker}`);
  }
  assert.ok(src.includes("audio-playing-level"), "the read-only Playing level -> Mixer bridge is missing");
  assert.ok(src.includes("openMixerFor"), "the Playing level does not open Mixer on its app");
});

check("shuffle/loop controls are capability-gated and dispatched", () => {
  const controls = read(join(AUDIO, "ui/controls.tsx"));
  assert.match(controls, /capabilities\(\)\.canShuffle/, "the shuffle control is not capability-gated");
  assert.match(controls, /capabilities\(\)\.canLoop/, "the loop control is not capability-gated");
  assert.match(controls, /actions\.toggleShuffle/, "shuffle is not dispatched");
  assert.match(controls, /actions\.cycleLoop/, "loop is not dispatched");
  const model = read(join(AUDIO, "domain/audio-model.ts"));
  assert.match(model, /canShuffle:\s*boolean/, "PlayerCapabilities has no canShuffle");
  assert.match(model, /canLoop:\s*boolean/, "PlayerCapabilities has no canLoop");
});

let failed = 0;
for (const { name, ok, err } of checks) {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) {
    failed++;
    console.log(`       ${err.message.split("\n").join("\n       ")}`);
  }
}

console.log(
  `\n${checks.length - failed}/${checks.length} render checks passed` +
    (failed ? ` — ${failed} FAILED` : "")
);
if (failed) {
  console.log(
    "\nThe panel is not wired. It will compile and bundle, and it will render " +
      "nothing.\nSee tasks.md 6.0."
  );
}
process.exit(failed ? 1 : 0);
