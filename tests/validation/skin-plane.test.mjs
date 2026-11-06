#!/usr/bin/env node
// Appearance-v2 gate (REQ-004).
//
// The runtime publishes palette + skin + mode as ONE generation and the app
// installs it through the Appearance port. These assertions pin the app-side
// contract so a later refactor can not silently reintroduce a split
// theme+skin path, a live-refresh handler or an unnamespaced layout token:
//
//   1. one module-level `createAppearance({ configDir: "ags" })` instance is
//      shared by startup and both token consumers, and `main()` applies it;
//   2. the request surface is unchanged and appearance is not a request
//      handler (restart lane only);
//   3. SettingsPanel/BluetoothContent read their namespaced layout tokens with
//      fallbacks;
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
 * Strip comments before scanning. The appearance contract is documented in
 * prose that names the refresh paths it forbids; raw text would make that
 * documentation read as the defect it describes.
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

// ── 1. One Appearance instance, one apply at startup ──────────────────────

const app = stripComments(read("app.tsx"));
const singleton = stripComments(read("lib", "appearance.ts"));

assert.match(
  singleton,
  /export const appearance = createAppearance\(\{ configDir: "ags" \}\)/,
  "lib/appearance.ts must own the bar's one createAppearance({ configDir: \"ags\" }) instance",
);
assert.match(
  app,
  /import \{ appearance \} from "\.\/lib\/appearance"/,
  "app.tsx must import the shared Appearance instance",
);
assert.doesNotMatch(
  app,
  /ags-platform\/adapters\/(?:theme|skin)"/,
  "app.tsx must not import the v1 theme/skin adapters",
);
assert.doesNotMatch(app, /\btheme\.apply\(\)/);
assert.doesNotMatch(app, /\bskin\.apply\(\)/);
assert.equal(
  (app.match(/appearance\.apply\(\)/g) ?? []).length,
  1,
  "the appearance is applied once at startup, not refreshed in place",
);
const applyAt = app.indexOf("appearance.apply()");
const mainAt = app.indexOf("main()");
assert.ok(applyAt >= 0 && mainAt >= 0 && applyAt > mainAt, "appearance.apply() must run in main()");

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
assert.ok(handlerStart >= 0 && mainAt > handlerStart);
assert.doesNotMatch(
  app.slice(handlerStart, mainAt),
  /\bappearance\b/,
  "the appearance must not be reachable from the request handler",
);

// ── 3. Namespaced, TSX-owned layout tokens ────────────────────────────────

const settings = stripComments(read("settings-panel", "SettingsPanel.tsx"));
assert.match(
  settings,
  /import \{ appearance \} from "\.\.\/lib\/appearance"/,
  "the settings surface must use the shared Appearance instance",
);
assert.match(
  settings,
  /appearance\.value\("layout\.ags\.panel-width", 312\)/,
  "the settings surface must read layout.ags.panel-width with its 312 fallback",
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
  /import \{ appearance \} from "\.\.\/\.\.\/lib\/appearance"/,
  "the Bluetooth lists must use the shared Appearance instance",
);
assert.match(
  bluetooth,
  /appearance\.value\("layout\.ags\.bt-list-spacing", 4\)/,
  "the Bluetooth lists must read layout.ags.bt-list-spacing with its 4 fallback",
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
