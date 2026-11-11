import { registry } from "ags-platform/adapters/icon-registry"
import { close } from "../state"
import { launchScopedApp } from "../../lib/scopedLauncher"

/**
 * Hyprmod action tile — no toggle state. Closing the panel first keeps focus
 * behavior predictable when the launcher opens.
 *
 * Hyprmod is long-lived, so it is launched in its own transient systemd scope:
 * otherwise `KillMode=mixed` would SIGKILL it on the next AGS restart.
 */
export function HyprmodTile() {
  return (
    <button
      class="settings-mini"
      onClicked={() => {
        close()
        void launchScopedApp("hyprmod")
      }}
      canFocus={false}
      tooltipText="Open Hyprmod"
    >
      <box spacing={9}>
        <image
          pixel_size={28}
          class="settings-mini-icon"
          $={(self) =>
            self.set_from_file(registry.resolve("settings-panel", "hyprmod") ?? "")
          }
        />
        <label class="settings-mini-title" label="Hyprmod" />
      </box>
    </button>
  )
}
