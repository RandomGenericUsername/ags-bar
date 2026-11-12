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

check("audio-panel.css is structure only; the selected skin paints it", () => {
  const css = stripComments(read(join(AUDIO, "audio-panel.css")));
  // The app stylesheet must not bake a skin: no palette role, no skin radius,
  // shadow, blur, type scale or ink. Those live in the app-owned skin target
  // (`dotfiles-assets/skins/templates/ags.gtk.css.j2`) and arrive at USER
  // priority through the composed appearance.
  assert.ok(!/@[a-z_]+\b/.test(css), "audio-panel.css references a palette role; paint belongs in the skin template");
  const literals = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
  assert.deepEqual(
    literals.filter((value) => value !== "#4ade80"),
    [],
    "the only literal colour may be the semantic live/playing green",
  );
  assert.ok(!/\brgba?\(/.test(css), "the sound stylesheet uses an rgb()/rgba() literal");
  assert.ok(!/backdrop-filter\s*:/.test(css), "backdrop-filter belongs in the skin template");
  assert.ok(!/outline\s*:/.test(css), "focus outline belongs in the skin template");
  const radii = [...css.matchAll(/border-radius\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.deepEqual(
    radii.filter((value) => value !== "0" && value !== "999px"),
    [],
    `skin radii leaked into the app stylesheet: ${radii.join(", ")}`,
  );
  const shadows = [...css.matchAll(/box-shadow\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.deepEqual(shadows.filter((value) => value !== "none"), [], "box-shadow belongs in the skin template");
  const colours = [...css.matchAll(/(?<![\w-])color\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.deepEqual(colours, [], `ink leaked into the app stylesheet: ${colours.join(", ")}`);
  const sizes = [...css.matchAll(/font-size\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  // Only content glyph sizes stay app-owned; all text sizes come from type.*.
  assert.deepEqual(sizes.filter((value) => !["12px", "14px", "15px", "17px"].includes(value)), [],
    `type sizes leaked into the app stylesheet: ${sizes.join(", ")}`);
});

check("the persistent hero is outside the scroll area and the deck is complete", () => {
  const src = popupSrc;
  const hero = src.indexOf("audio-hero");
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

check("the mix note, Mixer playback and duplicate app tile are gone", () => {
  assert.ok(!popupSrc.includes("Muted — the level is kept."), "the removed muted note is back");
  const mixer = popupSrc.slice(popupSrc.indexOf("function MixerRow"), popupSrc.indexOf("function MixerEmpty"));
  assert.ok(mixer.length > 0, "MixerRow not found");
  assert.ok(!mixer.includes("playerAction"), "Mixer still dispatches playback");
  assert.ok(!mixer.includes("audio-mixer-play"), "Mixer still renders a play/pause control");
  const mock = read(join(AGS, "tickets/REQ-005-sound-panel-design/mock.html"));
  assert.ok(!mock.includes("Muted — the level is kept."), "the mock still carries the muted note");
  assert.ok(!mock.includes("data-mixer-play"), "the mock Mixer still has playback");
});

check("the Playing page uses track artwork with a small app badge", () => {
  const controls = read(join(AUDIO, "ui/controls.tsx"));
  assert.match(controls, /export function TrackArtwork/, "no TrackArtwork component");
  assert.match(controls, /audio-track-badge/, "no app badge over the track artwork");
  assert.match(popupSrc, /TrackArtwork row=\{row\} size=\{40\}/, "Playing page does not use TrackArtwork");
  const page = popupSrc.slice(popupSrc.indexOf("function PlayingPage"), popupSrc.indexOf("function PlayingDeck"));
  assert.ok(!page.includes("<AppTile"), "Playing page still uses an app tile for its artwork/head");
});

check("the settings popover is one surface and a sibling Gtk.Popover", () => {
  const css = stripComments(read(join(AUDIO, "audio-panel.css")));
  const popover = css.slice(css.indexOf("popover.audio-settings-popover"));
  assert.match(popover, /border:\s*none/, "the native popover border is not reset");
  assert.match(popover, /padding:\s*0/, "the native popover padding is not reset");
  assert.match(popupSrc, /new Gtk\.Popover/, "the settings surface is not a popover");
  assert.match(popupSrc, /popover\.set_parent\(anchor\)/, "the settings popover is not anchored as a sibling");
  assert.ok(!popupSrc.includes('class="audio-settings-popover-shell"'), "nested settings shell");
});

check("resolved artwork reaches both the Mixer rows and Playing pages", () => {
  const composition = read(join(AUDIO, "composition.ts"));
  assert.match(composition, /rows: projected\.rows\.map\(withArtwork\)/, "rows lack the artwork overlay");
  assert.match(composition, /playingRows: projected\.playingRows\.map\(withArtwork\)/, "Playing pages never receive resolved artwork");
});

check("the artwork cache never recreates an existing directory", () => {
  const adapter = read(join(AUDIO, "adapters/mpris/mpris-adapter.ts"));
  const calls = adapter.split("\n").filter((line) => line.includes("this.directory.make_directory_with_parents"));
  assert.ok(calls.length >= 2, "the cache directory creation calls are missing");
  for (const line of calls) {
    assert.match(line, /query_exists\(null\)/, `unconditional cache directory creation: ${line.trim()}`);
  }
});

check("the panel poll updates the MPRIS position while visible", () => {
  assert.match(popupSrc, /GLib\.timeout_add\(/, "no visible-panel position poll");
  assert.match(popupSrc, /binding\.actions\.refreshPosition/, "the poll does not dispatch refreshPosition");
  assert.match(read(join(AUDIO, "binding.ts")), /refreshPosition\(playerId: string\)/, "the binding has no refreshPosition");
  assert.match(read(join(AUDIO, "adapters/mpris/mpris-adapter.ts")), /async refreshPosition\(/, "the adapter has no Position read");
  assert.match(read(join(AUDIO, "application/ports.ts")), /refreshPosition\(playerId: PlayerId\)/, "the port has no refreshPosition");
});

check("the panel is content-sized with a scroll fallback, not fixed dead space", () => {
  assert.match(popupSrc, /body\.measure\(Gtk\.Orientation\.VERTICAL/, "the deck body is not measured");
  assert.match(popupSrc, /height_request/, "the scroller height is not driven by the content measure");
  assert.ok(!popupSrc.includes("heightRequest={scrollHeight}"), "the fixed scroller height is back");
});

check("the output gear is the settings-panel registry image and icons are bare", () => {
  assert.match(popupSrc, /icon\(\"settings-panel\", \"settings\"\)/, "the Output gear does not resolve the settings-panel image");
  assert.ok(!popupSrc.includes("⚙"), "the Output header still uses the text gear");
  const css = stripComments(read(join(AUDIO, "audio-panel.css")));
  const button = css.slice(css.indexOf(".audio-icon-button {"), css.indexOf(".audio-icon-button {") + 500);
  assert.match(button, /background-color:\s*transparent/, "icon buttons are not bare");
  assert.match(button, /border:\s*1px solid transparent/, "icon buttons keep a control border");
});

check("transport controls use the registry media-controls art", () => {
  const controls = read(join(AUDIO, "ui/controls.tsx"));
  assert.match(controls, /icon\("media-controls"/, "shuffle/repeat do not resolve media-controls");
  assert.match(controls, /shuffle-active/, "the active shuffle variant is not used");
  assert.match(controls, /repeat-once/, "repeat-one shape is not used");
  assert.match(controls, /repeat-off/, "repeat-off shape is not used");
  assert.ok(!controls.includes("GlyphButton"), "a text glyph control remains");
  assert.ok(!controls.includes("⇄") && !controls.includes("↻"), "text shuffle/repeat glyphs remain");
  const icons = JSON.parse(read(join(AGS, "icons.json")));
  assert.ok(icons["media-controls"], "icons.json has no media-controls group");
  assert.ok(icons["settings-panel"]?.variants?.some((v) => v.name === "settings"), "icons.json has no settings-panel gear");
  assert.equal(icons["settings"]?.variants?.[0]?.template, "status-bar/settings/default/icon.svg");
});

check("the strip uses a 32px transparent thumbnail and the tray centers larger controls", () => {
  const media = read(join(AGS, "bar/widgets/media.tsx"));
  assert.match(media, /size=\{32\} className="audio-strip-art"/, "strip artwork is not 32px");
  assert.ok(!media.includes("maxWidthChars"), "the strip still caps its text width");
  const tray = read(join(AUDIO, "TrayPopup.tsx"));
  assert.match(tray, /halign=\{Gtk\.Align\.CENTER\}/, "tray transport is not centered");
  assert.match(tray, /playSize=\{36\} iconSize=\{18\}/, "tray transport icons are not enlarged");
  const css = stripComments(read(join(AUDIO, "audio-panel.css")));
  assert.match(css, /\.audio-strip-art\.audio-app-tile\s*\{[^}]*background-color:\s*transparent/, "strip artwork keeps a tile fill");
  assert.match(css, /\.audio-strip-art\.audio-app-tile\s*\{[^}]*border:\s*none/, "strip artwork keeps a tile border");
});

check("the Input section refits the panel after collapsing", () => {
  assert.match(popupSrc, /<With value=\{inputOpen\}>/, "Input body is not conditionally mounted");
  assert.match(popupSrc, /fitAfterLayout/, "no post-layout height recalculation");
  assert.match(popupSrc, /GLib\.timeout_add\([^\n]*fit\(\)/, "no delayed fit after the state change");
});

check("the muted output dims the big value without moving layout", () => {
  assert.match(popupSrc, /is-output-muted/, "the hero never marks the muted state");
  const css = stripComments(read(join(AUDIO, "audio-panel.css")));
  assert.match(
    css,
    /\.audio-hero\.is-output-muted \.audio-big-value\s*\{[^}]*opacity:\s*0\.42/,
    "the muted big value is not dimmed",
  );
});

check("spawned settings/tray windows leave radius to the skin surface", () => {
  const css = stripComments(read(join(AUDIO, "audio-panel.css")));
  for (const selector of ["window.audio-popup", "window.tray-popup"]) {
    const start = css.indexOf(selector);
    assert.ok(start >= 0, `${selector} reset missing`);
    const block = css.slice(start, css.indexOf("}", start));
    assert.match(block, /border-radius:\s*0/, `${selector} keeps an outer radius`);
    assert.match(block, /border:\s*none/, `${selector} keeps an outer border`);
    assert.match(block, /box-shadow:\s*none/, `${selector} keeps an outer shadow`);
  }
  const settings = css.slice(css.indexOf("popover.audio-settings-popover"));
  assert.match(settings, /border-radius:\s*0/, "the settings popover keeps an outer radius");
  assert.match(settings, /border:\s*none/, "the settings popover keeps an outer border");
  assert.match(settings, /box-shadow:\s*none/, "the settings popover keeps an outer shadow");
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
