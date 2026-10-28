// ---------------------------------------------------------------------------
// Speed-test writable state: XDG state paths + one-time legacy migration.
//
// AD-37 says an installed tag is immutable, so a tag bump must not reset user
// state. The service cannot be imported here (it pulls `gi://GLib` and `ags`),
// so the decision-shaped core lives in `services/speedtest-state.ts` and this
// suite drives it through a Node fs adapter. The tag-bump test below is the
// gate the cutover ticket asks for: seed the OLD tag's config dir, migrate,
// delete that directory (a tag bump / rollback), create a fresh empty one, and
// prove the interval, server mode and last measurement are still there.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict"
import { test } from "node:test"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
  migrateLegacySpeedTestState,
  speedTestStatePaths,
  type SpeedTestStatePaths,
  type StateFs,
} from "../../services/speedtest-state.ts"

const nodeFs: StateFs = {
  exists: (path) => existsSync(path),
  read: (path) => {
    try {
      return readFileSync(path, "utf8")
    } catch {
      return null
    }
  },
  write: (path, contents) => {
    try {
      writeFileSync(path, contents)
      return true
    } catch {
      return false
    }
  },
  mkdirp: (path) => {
    try {
      mkdirSync(path, { recursive: true })
      return true
    } catch {
      return false
    }
  },
}

type Roots = { stateHome: string; configHome: string; cleanup: () => void }

/** A throwaway pair of XDG roots, one per test. */
function roots(): Roots {
  const base = mkdtempSync(join(tmpdir(), "ags-bar-speedtest-"))
  return {
    stateHome: join(base, "state"),
    configHome: join(base, "config"),
    cleanup: () => rmSync(base, { recursive: true, force: true }),
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2))
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
}

const LEGACY_CONFIG = {
  interval_ms: 45000,
  run_on_connect: false,
  server_mode: "auto",
  notify_on_test: false,
}

const LEGACY_LAST_RUN = {
  result: { down_mbps: 512.4, up_mbps: 87.1, latency_ms: 14.2 },
  ran_at: 1750000000000,
}

/** Seed the pre-cutover files exactly where the old deployment wrote them. */
function seedLegacy(paths: SpeedTestStatePaths): void {
  writeJson(paths.legacyConfigPath, LEGACY_CONFIG)
  writeJson(paths.legacyLastRunPath, LEGACY_LAST_RUN)
}

test("state paths live under the XDG state root, never the config/tag root", () => {
  const { stateHome, configHome, cleanup } = roots()
  try {
    const paths = speedTestStatePaths(stateHome, configHome)
    assert.equal(paths.stateDir, `${stateHome}/ags`)
    assert.equal(paths.configPath, `${stateHome}/ags/wifi-speedtest.json`)
    assert.equal(paths.lastRunPath, `${stateHome}/ags/wifi-speedtest-last.json`)
    assert.equal(paths.legacyConfigPath, `${configHome}/ags/wifi-speedtest.json`)
    assert.equal(paths.legacyLastRunPath, `${configHome}/ags/wifi-speedtest-last.json`)
    // The writable targets must be outside the directory the config link points
    // at; only the migration SOURCES may be under it.
    assert.equal(paths.configPath.startsWith(`${configHome}/`), false)
    assert.equal(paths.lastRunPath.startsWith(`${configHome}/`), false)
  } finally {
    cleanup()
  }
})

test("the one-time migration adopts settings and the last measurement", () => {
  const { stateHome, configHome, cleanup } = roots()
  try {
    const paths = speedTestStatePaths(stateHome, configHome)
    seedLegacy(paths)

    const outcome = migrateLegacySpeedTestState(paths, nodeFs)
    assert.deepEqual(outcome.migrated, [paths.configPath, paths.lastRunPath])
    assert.deepEqual(outcome.kept, [])
    assert.deepEqual(outcome.invalid, [])
    assert.deepEqual(outcome.failed, [])

    assert.deepEqual(readJson(paths.configPath), LEGACY_CONFIG)
    assert.deepEqual(readJson(paths.lastRunPath), LEGACY_LAST_RUN)
    // The source files are read-only to the migration: the old tag may be
    // mounted read-only and a rollback to it must still work.
    assert.ok(existsSync(paths.legacyConfigPath))
    assert.ok(existsSync(paths.legacyLastRunPath))
  } finally {
    cleanup()
  }
})

test("existing XDG state always wins over the legacy copy", () => {
  const { stateHome, configHome, cleanup } = roots()
  try {
    const paths = speedTestStatePaths(stateHome, configHome)
    seedLegacy(paths)
    // The user changed the interval after the first migration.
    writeJson(paths.configPath, { ...LEGACY_CONFIG, interval_ms: 999000 })

    const outcome = migrateLegacySpeedTestState(paths, nodeFs)
    assert.deepEqual(outcome.kept, [paths.configPath])
    assert.deepEqual(outcome.migrated, [paths.lastRunPath])
    assert.equal(readJson(paths.configPath).interval_ms, 999000)

    // Running it again is a no-op: both targets now exist.
    const again = migrateLegacySpeedTestState(paths, nodeFs)
    assert.deepEqual(again.migrated, [])
    assert.deepEqual(again.kept, [paths.configPath, paths.lastRunPath])
    assert.equal(readJson(paths.configPath).interval_ms, 999000)
  } finally {
    cleanup()
  }
})

test("a corrupt legacy file is not adopted and is retried after a fix", () => {
  const { stateHome, configHome, cleanup } = roots()
  try {
    const paths = speedTestStatePaths(stateHome, configHome)
    mkdirSync(`${configHome}/ags`, { recursive: true })
    writeFileSync(paths.legacyConfigPath, "{not json")

    const outcome = migrateLegacySpeedTestState(paths, nodeFs)
    assert.deepEqual(outcome.invalid, [paths.legacyConfigPath])
    assert.equal(existsSync(paths.configPath), false, "corrupt source must not create state")

    writeJson(paths.legacyConfigPath, LEGACY_CONFIG)
    const retried = migrateLegacySpeedTestState(paths, nodeFs)
    assert.deepEqual(retried.migrated, [paths.configPath])
    assert.deepEqual(readJson(paths.configPath), LEGACY_CONFIG)
  } finally {
    cleanup()
  }
})

test("tag bump: interval, server mode and last measurement survive", () => {
  const { stateHome, configHome, cleanup } = roots()
  try {
    const paths = speedTestStatePaths(stateHome, configHome)
    // v0.1.0 deployment: `config/ags` points at the installed tag, so the
    // service's old config-dir writes landed inside this directory.
    seedLegacy(paths)
    const first = migrateLegacySpeedTestState(paths, nodeFs)
    assert.equal(first.migrated.length, 2)

    // Tag bump: the old install directory is replaced by a pristine one.
    rmSync(configHome, { recursive: true, force: true })
    mkdirSync(`${configHome}/ags`, { recursive: true })

    // v0.1.1 starts against the empty new tag and runs the same migration.
    const afterBump = migrateLegacySpeedTestState(paths, nodeFs)
    assert.deepEqual(afterBump.migrated, [], "nothing to adopt from the new tag")
    assert.deepEqual(afterBump.kept, [paths.configPath, paths.lastRunPath])

    const config = readJson(paths.configPath)
    assert.equal(config.interval_ms, LEGACY_CONFIG.interval_ms)
    assert.equal(config.server_mode, "auto")
    assert.equal(config.run_on_connect, false)
    const lastRun = readJson(paths.lastRunPath)
    assert.deepEqual(lastRun.result, LEGACY_LAST_RUN.result)
    assert.equal(lastRun.ran_at, LEGACY_LAST_RUN.ran_at)
  } finally {
    cleanup()
  }
})

test("a fresh install with no legacy files writes nothing and keeps defaults", () => {
  const { stateHome, configHome, cleanup } = roots()
  try {
    const paths = speedTestStatePaths(stateHome, configHome)
    const outcome = migrateLegacySpeedTestState(paths, nodeFs)
    assert.deepEqual(outcome.migrated, [])
    assert.deepEqual(outcome.kept, [])
    assert.deepEqual(outcome.invalid, [])
    assert.deepEqual(outcome.failed, [])
    assert.equal(existsSync(paths.stateDir), false, "no state dir is created without a write")
  } finally {
    cleanup()
  }
})
