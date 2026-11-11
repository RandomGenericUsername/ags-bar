// ---------------------------------------------------------------------------
// Long-lived GUI launches from the bar (decision D1-B).
//
// WHY A TRANSIENT SCOPE. The bar runs as `dotfiles-ags-bar.service`, whose unit
// uses `KillMode=mixed`: on restart the main AGS process gets SIGTERM and every
// remaining process in the service cgroup gets SIGKILL. A GUI app launched with
// plain `execAsync(["hyprmod"])` is a child in that cgroup, so restarting the
// bar (or a bar crash) kills the app the user just opened. `systemd-run --user
// --scope` puts the app in its OWN transient scope; the bar's cgroup no longer
// owns it, so an AGS restart leaves it running.
//
// WHY `--collect`. The transient scope is unloaded after its processes exit,
// so repeated launches do not accumulate failed/abandoned units.
//
// WHY ENV FORWARDING. `--scope` still starts from the systemd user manager's
// environment. The compositor/session variables a GUI needs may only exist in
// the AGS process, so they are forwarded explicitly with `--setenv`.
//
// WHY AN ALLOWLIST. This helper is called from UI handlers with a fixed id, not
// arbitrary user input. Keeping the executable per id in one registry means a
// new launch site cannot quietly bypass the scope policy, and tests can pin the
// exact argv. Commands are always arrays: nothing is concatenated into a shell
// string, so spaces and metacharacters in an argument stay one argument.
//
// PURE: no `ags`, no `gi://*`, no I/O. The live adapter (`lib/scopedLauncher.ts`)
// supplies exec, environment, logging and the failure notification.
// ---------------------------------------------------------------------------

/** Session variables a long-lived GUI needs when started outside AGS. */
export const PRESERVED_ENV_VARS = [
  "WAYLAND_DISPLAY",
  "XDG_RUNTIME_DIR",
  "DBUS_SESSION_BUS_ADDRESS",
] as const

export type ScopedAppId =
  | "hyprmod"
  | "power-options-gtk"
  | "pavucontrol"
  | "thunderbird"
  | "system-monitor"
  | "wifi-tui"
  | "bluetooth-manager"
  | "network-connections"

export interface ScopedAppSpec {
  readonly id: ScopedAppId
  readonly label: string
  /** Complete command line; `argv[0]` is the allowlisted executable. */
  readonly argv: readonly [string, ...string[]]
}

/**
 * The launchable long-lived GUI apps, by stable id.
 *
 * Do NOT add a short-lived command here: `brightnessctl`, `wpctl`, `pw-dump`,
 * MPRIS/speedtest helpers and the capture-cluster requests belong to AGS and
 * must die with it. `wlogout` is a transient logout overlay, not a long-lived
 * application, so it keeps its direct launch.
 */
export const SCOPED_APPS: Readonly<Record<ScopedAppId, ScopedAppSpec>> = {
  hyprmod: { id: "hyprmod", label: "Hyprmod", argv: ["hyprmod"] },
  "power-options-gtk": {
    id: "power-options-gtk",
    label: "Power Options",
    argv: ["power-options-gtk"],
  },
  pavucontrol: { id: "pavucontrol", label: "PulseAudio Volume Control", argv: ["pavucontrol"] },
  thunderbird: { id: "thunderbird", label: "Thunderbird", argv: ["thunderbird"] },
  "system-monitor": {
    id: "system-monitor",
    label: "System Monitor",
    argv: ["kitty", "--", "btop"],
  },
  "wifi-tui": {
    id: "wifi-tui",
    label: "Wi-Fi TUI",
    argv: ["kitty", "--", "wifitui", "tui"],
  },
  "bluetooth-manager": {
    id: "bluetooth-manager",
    label: "Bluetooth Manager",
    argv: ["blueman-manager"],
  },
  "network-connections": {
    id: "network-connections",
    label: "Network Connections",
    argv: ["nm-connection-editor"],
  },
}

/** Every executable a scoped launch may run. */
export const SCOPED_EXECUTABLE_ALLOWLIST: ReadonlySet<string> = new Set(
  Object.values(SCOPED_APPS).map((app) => app.argv[0]),
)

export type EnvReader = (name: string) => string | null | undefined

export type ScopedExec = (argv: readonly string[]) => Promise<unknown> | unknown

export interface ScopedLaunchDeps {
  readonly exec: ScopedExec
  readonly environment: EnvReader
  /** Informational line for a dispatched launch. */
  readonly log?: (message: string) => void
  /** Failure line; must reach a real log, not be swallowed. */
  readonly logError: (message: string) => void
  /** Visible failure surface (the adapter posts a session notification). */
  readonly notifyFailure: (summary: string, body: string) => void
}

export interface ScopedLaunchResult {
  readonly ok: boolean
  readonly argv: readonly string[]
}

/** Resolve a registry id, rejecting anything not in the allowlist. */
export function resolveScopedApp(id: string): ScopedAppSpec {
  if (!Object.prototype.hasOwnProperty.call(SCOPED_APPS, id)) {
    throw new Error(`scoped launch: app is not allowlisted: ${id}`)
  }
  const spec = SCOPED_APPS[id as ScopedAppId]
  if (!SCOPED_EXECUTABLE_ALLOWLIST.has(spec.argv[0])) {
    throw new Error(`scoped launch: executable is not allowlisted: ${spec.argv[0]}`)
  }
  return spec
}

/**
 * Build the exact argv passed to `execAsync`/`execve`. No shell is involved.
 *
 * `--` ends systemd-run's option parsing so an app argument can never be eaten
 * as a systemd option. Environment entries are added only when present and
 * non-empty; a missing compositor variable is left unset rather than forwarded
 * as the literal string "undefined".
 */
export function buildScopedLaunchArgv(
  spec: ScopedAppSpec,
  environment: EnvReader,
): string[] {
  const resolved = resolveScopedApp(spec.id)
  if (resolved.argv !== spec.argv) {
    throw new Error(`scoped launch: argv does not match registry for ${spec.id}`)
  }
  const argv = ["systemd-run", "--user", "--scope", "--collect", "--quiet"]
  for (const name of PRESERVED_ENV_VARS) {
    const value = environment(name)
    if (typeof value === "string" && value.length > 0) {
      argv.push(`--setenv=${name}=${value}`)
    }
  }
  argv.push("--", ...resolved.argv)
  return argv
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim() || error.name
  }
  return String(error)
}

/**
 * Dispatch one scoped launch and surface failure on both channels:
 * `logError` for the journal and `notifyFailure` for the session toast.
 *
 * Resolves `false` on failure instead of rejecting, so a click handler cannot
 * produce an unhandled rejection when the app is missing.
 */
export async function launchScopedApp(
  id: ScopedAppId,
  deps: ScopedLaunchDeps,
): Promise<ScopedLaunchResult> {
  const spec = resolveScopedApp(id)
  const argv = buildScopedLaunchArgv(spec, deps.environment)
  deps.log?.(`scoped launch: ${spec.id} (${spec.label})`)
  try {
    await deps.exec(argv)
    return { ok: true, argv }
  } catch (error) {
    const reason = errorMessage(error)
    const summary = `Could not launch ${spec.label}`
    const body = `${spec.label} did not start (${reason}). Check that it is installed.`
    deps.logError(
      `scoped launch failed: ${spec.id} (${spec.label}): ${reason}; argv=${JSON.stringify(argv)}`,
    )
    deps.notifyFailure(summary, body)
    return { ok: false, argv }
  }
}
