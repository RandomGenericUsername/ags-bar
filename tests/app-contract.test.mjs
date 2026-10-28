// ---------------------------------------------------------------------------
// Manifest + restart + template conformance for the ags-bar extraction
// (AD-26/AD-27/AD-30/AD-33/AD-36/AD-37).
//
// This is the repo-local gate the standalone contract requires:
//   1. `app.manifest.json` is schema-valid and carries the bar identity;
//   2. app.tsx / the window / style agree with that identity;
//   3. the request handler surface survives the move and no live
//      palette-refresh handler was introduced;
//   4. install-time artifacts (colors.css, icons.json) and writable
//      wifi-speedtest state are documented and stay outside app writes;
//   5. the shared dev-flow template is present and the platform's own
//      `checkAppRepo` template gate passes;
//   6. the contracts v0.3.0 manifest schema and the Makefile pins agree.
//
// Run from the repo root:  make conformance
// ---------------------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAgsAppManifest } from "ags-platform/ports/app-manifest";
import {
  checkAppRepoAt,
  formatAppConformanceReport,
} from "ags-platform/conformance/app-conformance";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const IDENTITY = {
  schemaVersion: 1,
  app: "bar",
  instance: "ags",
  configDir: "ags",
  mode: "restart",
  holdsUnsavedState: false,
};

const REQUEST_COMMANDS = [
  "popup-close",
  "settings-close",
  "audio-panel-open",
  "audio-panel-debug",
];

function readText(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function findContractsRoot() {
  const override = process.env.CONTRACTS_ROOT;
  if (override) return override;
  let dir = ROOT;
  for (let i = 0; i < 8; i += 1) {
    dir = dirname(dir);
    if (existsSync(join(dir, "contracts", "schemas", "ags-app-manifest.schema.json"))) {
      return join(dir, "contracts");
    }
  }
  return null;
}

// ── 1. Manifest identity ───────────────────────────────────────────────────

test("the manifest is schema-valid and carries the bar restart identity", () => {
  const parsed = parseAgsAppManifest(readText("app.manifest.json"));
  assert.equal(parsed.ok, true, JSON.stringify(parsed.issues ?? []));
  assert.deepEqual(parsed.manifest, IDENTITY);
  assert.equal(parsed.manifest.mode, "restart");
  assert.equal(parsed.manifest.holdsUnsavedState, false);
});

test("the manifest agrees with app.tsx, the window and the stylesheet", () => {
  const app = readText("app.tsx");
  assert.match(app, /instanceName:\s*"ags"/);
  assert.match(readText("bar", "Bar.tsx"), /name="bar"/);
  assert.match(readText("style.css"), /window#bar/);
  assert.equal(JSON.parse(readText("package.json")).name, "ags-bar");
});

test("the repo root is the app package", () => {
  assert.ok(existsSync(join(ROOT, "app.tsx")));
  assert.ok(existsSync(join(ROOT, "app.manifest.json")));
  assert.ok(!existsSync(join(ROOT, "bar", "app.tsx")));
});

// ── 2. Restart mode and the preserved request surface ──────────────────────

test("the bar keeps its complete request handler surface", () => {
  const app = readText("app.tsx");
  assert.match(app, /requestHandler\(argv:\s*string\[\],\s*res:/);
  for (const command of REQUEST_COMMANDS) {
    assert.ok(app.includes(`"${command}"`), `missing request command: ${command}`);
  }
  assert.match(app, /res\(`unknown request: \$\{argv\.join\(" "\)\}`\)/);
  // Esc must dismiss every overlay, not only the settings panel.
  for (const close of [
    "closeSettings()",
    "closeBluetoothPopup()",
    "closeAudio()",
    "closeWifiPopup()",
    "closeBatteryPopup()",
  ]) {
    assert.ok(app.includes(close), `popup-close no longer calls ${close}`);
  }
  const overlays = readText("overlays.ts");
  for (const id of ["wifi", "bluetooth", "battery", "settings", "audio"]) {
    assert.match(overlays, new RegExp(`id:\\s*"${id}"`), `overlay ${id} is not registered`);
  }
});

test("the bar is restart with no palette-refresh handler", () => {
  const app = readText("app.tsx");
  assert.doesNotMatch(app, /PALETTE_REFRESH_COMMAND/);
  assert.doesNotMatch(app, /createPaletteRefreshHandler/);
  assert.doesNotMatch(app, /ags-platform\/ports\/palette-refresh/);
  assert.doesNotMatch(app, /palette-refresh/);
  // Appearance is applied once at startup; no wallpaper-driven palette path.
  assert.match(app, /theme\.apply\(\)/);
  assert.doesNotMatch(app, /wallpaper\.state/);
});

test("app startup keeps the bar windows and the debug surface", () => {
  const app = readText("app.tsx");
  assert.match(app, /for \(const monitor of app\.get_monitors\(\)\)/);
  assert.match(app, /addWindow\(Bar\(monitor, audio\)\)/);
  assert.match(app, /addWindow\(SettingsCatcher\(primary\)\)/);
  assert.match(app, /addWindow\(AudioPopup\(primary, audio\)\)/);
  assert.match(app, /panel-debug\.json/);
});

// ── 3. Install-time concerns and writable state ────────────────────────────

test("colors.css is an install-time pointer, not a repo file", () => {
  assert.equal(existsSync(join(ROOT, "colors.css")), false, "colors.css must not be committed");
  const app = readText("app.tsx");
  assert.match(app, /theme\.apply\(\)/);
  const readme = readText("README.md");
  assert.match(readme, /colors\.css/);
  assert.match(readme, /XDG_CONFIG_HOME\/ags\/colors\.css/);
  assert.match(readme, /install time/i);
  assert.match(readme, /stable runtime-owned pointer/);
});

test("icons.json is the bar artifact and stays valid JSON", () => {
  const icons = JSON.parse(readText("icons.json"));
  assert.ok(icons["app-icons"], "icons.json lost its app-icons group");
  assert.ok(icons.volume, "icons.json lost its volume group");
  const readme = readText("README.md");
  assert.match(readme, /icons\.json/);
  assert.match(readme, /dotfiles-assets/);
  assert.match(readme, /provisioning verifies/i);
});

test("wifi-speedtest writable state is outside the repo and migration is documented", () => {
  const service = readText("services", "speedtest-service.ts");
  assert.match(service, /get_user_config_dir\(\)\}\/ags\/wifi-speedtest\.json/);
  assert.match(service, /get_user_config_dir\(\)\}\/ags\/wifi-speedtest-last\.json/);
  assert.equal(existsSync(join(ROOT, "wifi-speedtest-last.json")), false);
  assert.ok(existsSync(join(ROOT, "wifi-speedtest.json")), "legacy seed default is missing");

  const readme = readText("README.md");
  assert.match(readme, /Cutover state migration \(wifi-speedtest\)/);
  assert.match(readme, /XDG_STATE_HOME\/ags/);
  assert.match(readme, /tag bump/i);
  assert.match(readme, /seed default/);

  const ticket = readText(
    "tickets",
    "OPS-001-cutover-state-migration",
    "ticket.md",
  );
  assert.match(ticket, /wifi-speedtest\.json/);
  assert.match(ticket, /XDG_STATE_HOME/);
});

test("the audio stylesheet is applied from the deployed config dir", () => {
  const app = readText("app.tsx");
  assert.match(app, /get_user_config_dir\(\)\}\/ags\/audio\/audio-panel\.css/);
});

// ── 4. Repository template + platform conformance ──────────────────────────

test("the platform template gate passes for this repo", () => {
  const report = checkAppRepoAt(ROOT);
  assert.equal(report.ok, true, formatAppConformanceReport(report, ROOT));
});

test("the standalone dev-flow files are present", () => {
  for (const path of [
    "AGENTS.md",
    "README.md",
    "Makefile",
    "app.tsx",
    "app.manifest.json",
    "tsconfig.app.json",
    "scripts/worktree-guard.sh",
    "tickets/LIFECYCLE.md",
    "tickets/INDEX.md",
    "tickets/_template/requirement.md",
    "tests/app-contract.test.mjs",
    "tests/contract-drift.mjs",
    ".github/workflows/ci.yml",
  ]) {
    assert.ok(existsSync(join(ROOT, path)), `${path} is missing`);
  }
});

test("the contracts v0.3.0 manifest schema agrees with the platform", () => {
  const contractsRoot = findContractsRoot();
  assert.notEqual(contractsRoot, null, "cannot find contracts (set CONTRACTS_ROOT)");
  const schema = JSON.parse(
    readFileSync(join(contractsRoot, "schemas", "ags-app-manifest.schema.json"), "utf8"),
  );
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(
    [...schema.required].sort(),
    ["app", "configDir", "holdsUnsavedState", "instance", "mode", "schemaVersion"],
  );
  assert.equal(
    schema.allOf[0].then.properties.holdsUnsavedState.const,
    false,
    "restart stays invalid when holdsUnsavedState is true",
  );
});

test("the Makefile pins the v0.3.0 program tuple", () => {
  const makefile = readText("Makefile");
  assert.match(makefile, /^AGS_PLATFORM_VERSION := v0\.3\.0$/m);
  assert.match(makefile, /^CONTRACTS_VERSION := v0\.3\.0$/m);
  assert.match(makefile, /^BUNDLE_FILE := build\/ags-bar\.js$/m);
});
