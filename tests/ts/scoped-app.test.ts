// ---------------------------------------------------------------------------
// Decision D1-B: long-lived GUI launches run in a transient systemd user scope.
//
// The bar's service uses KillMode=mixed, so a plain child is SIGKILLed when AGS
// restarts. These tests pin the argv that moves the app out of the bar's cgroup,
// the environment forwarding it needs, the allowlist boundary and the visible
// failure path. The core is pure; exec/log/notify are injected fakes here.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PRESERVED_ENV_VARS,
  SCOPED_APPS,
  SCOPED_EXECUTABLE_ALLOWLIST,
  buildScopedLaunchArgv,
  launchScopedApp,
  resolveScopedApp,
  type ScopedAppSpec,
  type ScopedLaunchDeps,
} from "../../lib/scopedApp.ts"

const FULL_ENV: Record<string, string> = {
  WAYLAND_DISPLAY: "wayland-1",
  XDG_RUNTIME_DIR: "/run/user/1000",
  DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus",
}

function env(overrides: Record<string, string | undefined> = {}) {
  return (name: string): string | undefined =>
    Object.prototype.hasOwnProperty.call(overrides, name)
      ? overrides[name]
      : FULL_ENV[name]
}

describe("scoped app registry", () => {
  it("pins the exact long-lived GUI argv set", () => {
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(SCOPED_APPS).map(([id, app]) => [id, app.argv]),
      ),
      {
        hyprmod: ["hyprmod"],
        "power-options-gtk": ["power-options-gtk"],
        pavucontrol: ["pavucontrol"],
        thunderbird: ["thunderbird"],
        "system-monitor": ["kitty", "--", "btop"],
        "wifi-tui": ["kitty", "--", "wifitui", "tui"],
        "bluetooth-manager": ["blueman-manager"],
        "network-connections": ["nm-connection-editor"],
      },
    )
  })

  it("keeps every registry executable on the allowlist", () => {
    for (const app of Object.values(SCOPED_APPS)) {
      assert.equal(SCOPED_EXECUTABLE_ALLOWLIST.has(app.argv[0]), true, app.id)
    }
  })

  it("rejects an id that is not in the registry", () => {
    assert.throws(
      () => resolveScopedApp("rm"),
      /not allowlisted: rm/,
    )
  })

  it("rejects a tampered argv that differs from the registry", () => {
    const tampered = {
      id: "hyprmod",
      label: "Hyprmod",
      argv: ["sh", "-c", "hyprmod"],
    } as unknown as ScopedAppSpec
    assert.throws(
      () => buildScopedLaunchArgv(tampered, env()),
      /argv does not match registry for hyprmod/,
    )
  })
})

describe("scoped launch argv", () => {
  it("wraps the command in systemd-run with -- and no shell", () => {
    const argv = buildScopedLaunchArgv(SCOPED_APPS.hyprmod, env())
    assert.deepEqual(argv, [
      "systemd-run",
      "--user",
      "--scope",
      "--collect",
      "--quiet",
      "--setenv=WAYLAND_DISPLAY=wayland-1",
      "--setenv=XDG_RUNTIME_DIR=/run/user/1000",
      "--setenv=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus",
      "--",
      "hyprmod",
    ])
    assert.equal(argv.includes("-c"), false)
  })

  it("keeps an argv with arguments as separate array entries", () => {
    const argv = buildScopedLaunchArgv(SCOPED_APPS["system-monitor"], env())
    assert.deepEqual(argv.slice(-4), ["--", "kitty", "--", "btop"])
  })

  it("forwards only present, non-empty environment variables", () => {
    const argv = buildScopedLaunchArgv(
      SCOPED_APPS.thunderbird,
      env({ WAYLAND_DISPLAY: undefined, XDG_RUNTIME_DIR: "" }),
    )
    assert.equal(
      argv.some((arg) => arg.startsWith("--setenv=WAYLAND_DISPLAY")),
      false,
    )
    assert.equal(
      argv.some((arg) => arg.startsWith("--setenv=XDG_RUNTIME_DIR")),
      false,
    )
    assert.equal(
      argv.includes("--setenv=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus"),
      true,
    )
    assert.equal(PRESERVED_ENV_VARS.length, 3)
  })

  it("does not mutate the registry argv", () => {
    const before = [...SCOPED_APPS.pavucontrol.argv]
    buildScopedLaunchArgv(SCOPED_APPS.pavucontrol, env())
    assert.deepEqual(SCOPED_APPS.pavucontrol.argv, before)
  })
})

describe("scoped launch dispatch", () => {
  function deps(overrides: Partial<ScopedLaunchDeps> = {}) {
    const calls = {
      exec: [] as (readonly string[])[],
      log: [] as string[],
      logError: [] as string[],
      notify: [] as { summary: string; body: string }[],
    }
    const value: ScopedLaunchDeps = {
      exec: async (argv) => {
        calls.exec.push(argv)
        return ""
      },
      environment: env(),
      log: (message) => calls.log.push(message),
      logError: (message) => calls.logError.push(message),
      notifyFailure: (summary, body) => calls.notify.push({ summary, body }),
      ...overrides,
    }
    return { calls, deps: value }
  }

  it("execs the built argv once and reports success without a toast", async () => {
    const { calls, deps: d } = deps()
    const result = await launchScopedApp("network-connections", d)
    assert.equal(result.ok, true)
    assert.equal(calls.exec.length, 1)
    assert.deepEqual(calls.exec[0], result.argv)
    assert.equal(calls.exec[0][0], "systemd-run")
    assert.deepEqual(result.argv.slice(-2), ["--", "nm-connection-editor"])
    assert.deepEqual(calls.logError, [])
    assert.deepEqual(calls.notify, [])
    assert.match(calls.log[0] ?? "", /network-connections/)
  })

  it("logs and notifies visibly on a rejected command, without throwing", async () => {
    const { calls, deps: d } = deps({
      exec: async () => {
        throw new Error("Failed to execute child process: No such file")
      },
    })
    const result = await launchScopedApp("bluetooth-manager", d)
    assert.equal(result.ok, false)
    assert.equal(calls.logError.length, 1)
    assert.match(calls.logError[0] ?? "", /bluetooth-manager/)
    assert.match(calls.logError[0] ?? "", /No such file/)
    assert.equal(calls.notify.length, 1)
    assert.equal(calls.notify[0]?.summary, "Could not launch Bluetooth Manager")
    assert.match(calls.notify[0]?.body ?? "", /did not start/)
    assert.match(calls.notify[0]?.body ?? "", /Check that it is installed/)
  })

  it("catches a synchronous exec throw on the same failure path", async () => {
    const { calls, deps: d } = deps({
      exec: () => {
        throw new Error("ENOENT")
      },
    })
    const result = await launchScopedApp("pavucontrol", d)
    assert.equal(result.ok, false)
    assert.equal(calls.exec.length, 0)
    assert.equal(calls.logError.length, 1)
    assert.equal(calls.notify.length, 1)
  })
})
