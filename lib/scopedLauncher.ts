// Live wiring for the scoped-launch core (`lib/scopedApp.ts`).
//
// This is the only file that touches AGS/GIO: it supplies `execAsync`, reads the
// process environment with `GLib.getenv`, and routes failures to the journal and
// the session notification surface. Keeping those wires here lets the policy
// (registry, allowlist, argv, failure shape) stay pure and testable under Node.

import { execAsync } from "ags/process"
import GLib from "gi://GLib?version=2.0"
import { notifier } from "ags-platform/adapters/notifier"
import { registry } from "ags-platform/adapters/icon-registry"
import {
  launchScopedApp as launchScoped,
  type ScopedAppId,
} from "./scopedApp"

const LOG_PREFIX = "scoped-launch"

/**
 * Launch a long-lived GUI app in its own transient user scope.
 *
 * Fire-and-forget by design: click handlers should not await a GUI's lifetime.
 * A failure is logged and shown as a notification by the core callbacks, so the
 * user sees a missing app instead of a silent no-op.
 */
export function launchScopedApp(id: ScopedAppId): Promise<boolean> {
  return launchScoped(id, {
    exec: (argv) => execAsync([...argv]),
    environment: (name) => GLib.getenv(name),
    log: (message) => console.log(`${LOG_PREFIX}: ${message}`),
    logError: (message) => console.error(`${LOG_PREFIX}: ${message}`),
    notifyFailure: (summary, body) => {
      const icon = registry.resolve("settings-panel", "info-caution")
      notifier.post({
        app: "Launcher",
        summary,
        body,
        icon: icon === null ? undefined : { kind: "file", path: icon },
        timeoutMs: 8000,
      })
    },
  }).then((result) => result.ok)
}
