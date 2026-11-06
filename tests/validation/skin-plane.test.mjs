#!/usr/bin/env node
// Skin-plane pilot gate (REQ-003).
//
// The skin provider is composed and installed at USER priority by the platform;
// this app only orders it after the palette and consumes two TSX-owned layout
// tokens. These assertions pin the app-side contract so a later refactor can
// not silently reintroduce a live-refresh path or drop a token read:
//
//   1. app.tsx calls theme.apply() then skin.apply(), once each;
//   2. the request surface is unchanged and the skin is not a request handler;
//   3. SettingsPanel/BluetoothContent read their layout tokens with fallbacks;
//   4. style.css still carries the bundled glass fallback.
//
// Static, no desktop stack needed.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const AGS = resolve(HERE, "../..");

const read = (...parts) => readFileSync(join(AGS, ...parts), "utf8");

/**
 * Strip comments before scanning. The skin contract is documented in prose that
 * names the refresh paths it forbids; raw text would make that documentation
 * read as the defect it describes.
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

// ── 1. Startup order: palette first, composed skin provider last ───────────

const app = stripComments(read("app.tsx"));
assert.match(
  app,
  /import \{ skin \} from "ags-platform\/adapters\/skin"/,
  "app.tsx must import the Skin adapter",
);

const themeAt = app.indexOf("theme.apply()");
const skinAt = app.indexOf("skin.apply()");
assert.ok(themeAt >= 0, "app.tsx lost theme.apply()");
assert.ok(skinAt > themeAt, "skin.apply() must run after theme.apply()");
assert.equal(
  (app.match(/skin\.apply\(\)/g) ?? []).length,
  1,
  "the skin is applied once at startup, not refreshed in place",
);

// ── 2. Restart lane stays the only refresh path ───────────────────────────

assert.doesNotMatch(app, /palette-refresh/);
assert.doesNotMatch(app, /skin-refresh/);
assert.doesNotMatch(app, /wallpaper\.state/);

const commands = [...app.matchAll(/argv\[0\] === "([^"]+)"/g)].map((m) => m[1]);
assert.deepEqual(commands, [
  "popup-close",
  "settings-close",
  "audio-panel-open",
  "audio-panel-debug",
]);

const handlerStart = app.indexOf("requestHandler(");
const mainStart = app.indexOf("main()");
assert.ok(handlerStart >= 0 && mainStart > handlerStart);
assert.doesNotMatch(
  app.slice(handlerStart, mainStart),
  /\bskin\b/,
  "the skin must not be reachable from the request handler",
);

// ── 3. TSX-owned layout tokens ────────────────────────────────────────────

const settings = stripComments(read("settings-panel", "SettingsPanel.tsx"));
assert.match(
  settings,
  /skinValue\("layout\.panel-width", 312\)/,
  "the settings surface must read layout.panel-width with its 312 fallback",
);
assert.match(
  settings,
  /get width\(\) \{\n\s+return panelWidth\.peek\(\)\n\s+\}/,
  "the surface width must resolve the token when the host reads it",
);

const bluetooth = stripComments(
  read("components", "bluetooth", "BluetoothContent.tsx"),
);
assert.match(
  bluetooth,
  /skinValue\("layout\.bt-list-spacing", 4\)/,
  "the Bluetooth lists must read layout.bt-list-spacing with its 4 fallback",
);
assert.equal(
  (bluetooth.match(/spacing=\{btListSpacing\.peek\(\)\}/g) ?? []).length,
  2,
  "both Bluetooth list boxes must consume the spacing token",
);
assert.doesNotMatch(bluetooth, /spacing=\{4\}/);

// ── 4. Bundled glass fallback survives ────────────────────────────────────

const css = read("style.css");
assert.match(
  css,
  /\.settings-surface\s*\{[^}]*background-color:\s*alpha\(@surface,\s*0\.94\)/s,
  "style.css must keep the glass surface fallback",
);
assert.match(
  css,
  /\.settings-surface\s*\{[^}]*border-radius:\s*12px/s,
  "style.css must keep the glass radius fallback",
);
