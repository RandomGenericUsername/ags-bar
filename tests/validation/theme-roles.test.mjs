#!/usr/bin/env node
// Phase B semantic-role gate.
//
// The bar's CSS was written against CSG's positional `@color_00..15` carrier
// names. Under tpr those carriers resolve to unrelated Material roles, so a
// carrier-index migration would silently break state colors. This gate pins
// the outcome instead: no CSS/TS/TSX file may reference a legacy carrier, and
// the two stylesheets must use the `palette.v1` role names the platform's
// composed provider defines.
//
// Static, no desktop stack needed.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, relative, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const AGS = resolve(HERE, "../..");

const SKIP_DIRS = new Set([".git", "node_modules", "@girs", "build", ".dev", ".worktrees"]);
const EXTENSIONS = new Set([".css", ".ts", ".tsx"]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const legacy = [];
for (const file of walk(AGS)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/@color_[a-z0-9_]+/g)) {
    legacy.push(`${relative(AGS, file)}: ${match[0]}`);
  }
}

assert.deepEqual(
  legacy,
  [],
  "legacy @color_* carriers are back; map the site to a palette.v1 role instead:\n" +
    legacy.join("\n"),
);

const css = ["style.css", "audio/audio-panel.css"]
  .map((file) => readFileSync(join(AGS, file), "utf8"))
  .join("\n");

// The role set the migration actually relies on. Keeping this explicit means a
// stylesheet cannot quietly fall back to a producer alias (`@foreground`,
// `@accent`) or a role the platform does not define.
const requiredRoles = [
  "on_surface",
  "surface",
  "primary",
  "on_primary",
  "primary_container",
  "on_primary_container",
  "tertiary",
  "secondary",
  "surface_container_high",
  "surface_container_highest",
  "error",
];

for (const role of requiredRoles) {
  assert.ok(css.includes(`@${role}`), `the stylesheets lost their @${role} role reference`);
}
