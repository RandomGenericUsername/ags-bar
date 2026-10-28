// ---------------------------------------------------------------------------
// Pure path + migration core for the speed-test service's writable state
// (AD-37: installed tags are immutable; writable state lives under XDG).
//
// WHY THIS IS A SEPARATE MODULE. The service itself imports `gi://GLib` and
// `ags`, so it cannot run on a stock runner. Everything decision-shaped about
// where state lives and how legacy state is adopted is therefore kept here with
// no GLib/AGS import: the caller passes the two XDG roots in, and the file
// operations arrive as a port. The service supplies the GLib adapter; the
// tests supply Node's fs.
//
// THE STATE CONTRACT:
//   state dir      <XDG_STATE_HOME>/ags/
//   config         <XDG_STATE_HOME>/ags/wifi-speedtest.json
//   last run       <XDG_STATE_HOME>/ags/wifi-speedtest-last.json
//   legacy config  <XDG_CONFIG_HOME>/ags/wifi-speedtest.json
//   legacy last    <XDG_CONFIG_HOME>/ags/wifi-speedtest-last.json
//
// The legacy paths are the pre-cutover location. Under the old deployment
// `config/ags` pointed AT the installed tag, so those files lived inside it and
// a tag bump wiped the user's interval, server mode and last measurement.
// Migration reads them exactly once per file and never writes them: the old tag
// is read-only, and leaving the source in place is what makes the migration
// safely re-runnable (the target's existence is the gate, not a marker file).
// ---------------------------------------------------------------------------

export type SpeedTestStatePaths = {
  /** `<stateHome>/ags` — created on demand, never inside the install tree. */
  stateDir: string
  /** Read/write target for the persisted settings. */
  configPath: string
  /** Read/write target for the last measurement. */
  lastRunPath: string
  /** Pre-cutover config, read only by the one-time migration. */
  legacyConfigPath: string
  /** Pre-cutover last measurement, read only by the one-time migration. */
  legacyLastRunPath: string
}

/**
 * Resolve every speed-test path from the two XDG roots.
 *
 * `stateHome`/`configHome` are passed in already resolved (the service uses
 * `GLib.get_user_state_dir()` / `GLib.get_user_config_dir()`), so this module
 * carries no environment policy of its own and stays trivially testable.
 */
export function speedTestStatePaths(
  stateHome: string,
  configHome: string,
): SpeedTestStatePaths {
  const stateDir = `${stateHome}/ags`
  const legacyDir = `${configHome}/ags`
  return {
    stateDir,
    configPath: `${stateDir}/wifi-speedtest.json`,
    lastRunPath: `${stateDir}/wifi-speedtest-last.json`,
    legacyConfigPath: `${legacyDir}/wifi-speedtest.json`,
    legacyLastRunPath: `${legacyDir}/wifi-speedtest-last.json`,
  }
}

/**
 * The file operations migration needs, as a port.
 *
 * Deliberately narrow: `read` returns null instead of throwing, `write` returns
 * false instead of throwing, and `mkdirp` is idempotent. The service's GLib
 * adapter maps `file_get_contents`/`file_set_contents`/`mkdir_with_parents`
 * onto it; the tests map Node's fs.
 */
export type StateFs = {
  exists(path: string): boolean
  read(path: string): string | null
  write(path: string, contents: string): boolean
  mkdirp(path: string): boolean
}

export type MigrationOutcome = {
  /** Targets written from a legacy source, in migration order. */
  migrated: string[]
  /** Targets already present; the legacy source was ignored (state wins). */
  kept: string[]
  /** Legacy sources whose content is not a JSON object; nothing was written. */
  invalid: string[]
  /** Targets that could not be written (mkdir or write failure). */
  failed: string[]
}

/** A legacy file is only adopted when it parses to a JSON object. */
function isJsonObject(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
  } catch {
    return false
  }
}

/**
 * One-time adoption of the pre-cutover files.
 *
 * Rules (each is a test in `tests/ts/speedtest-state.test.ts`):
 *  1. A target that already exists is never overwritten — that is the "one
 *     time" in one-time migration, and it means a user edit after the first
 *     run always wins over the stale legacy copy.
 *  2. A legacy file is copied byte-for-byte, so the existing `interval_min`
 *     legacy-key handling in `loadConfig` still runs against it.
 *  3. A corrupt/non-object legacy file is NOT copied. The target stays absent,
 *     so the migration can retry after the source is fixed instead of
 *     entrenching the corruption in the new path.
 *  4. The legacy source is never deleted or modified: it may live in a
 *     read-only tag, and keeping it makes a rollback to the old tag work.
 */
export function migrateLegacySpeedTestState(
  paths: SpeedTestStatePaths,
  fs: StateFs,
): MigrationOutcome {
  const outcome: MigrationOutcome = {
    migrated: [],
    kept: [],
    invalid: [],
    failed: [],
  }
  const pairs: Array<[source: string, target: string]> = [
    [paths.legacyConfigPath, paths.configPath],
    [paths.legacyLastRunPath, paths.lastRunPath],
  ]
  for (const [source, target] of pairs) {
    if (fs.exists(target)) {
      outcome.kept.push(target)
      continue
    }
    if (!fs.exists(source)) continue
    const raw = fs.read(source)
    if (raw === null || !isJsonObject(raw)) {
      outcome.invalid.push(source)
      continue
    }
    if (!fs.mkdirp(paths.stateDir) || !fs.write(target, raw)) {
      outcome.failed.push(target)
      continue
    }
    outcome.migrated.push(target)
  }
  return outcome
}
