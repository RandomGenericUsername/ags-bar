import type { BarWidgetSpec } from "../../kit/widget"
import { iconByVariant } from "ags-platform/adapters/icon"
import { launchScopedApp } from "../../lib/scopedLauncher"

/** Status-bar Thunderbird launcher, expressed as a widget descriptor. */
export const thunderbirdWidget: BarWidgetSpec<undefined> = {
  id: "thunderbird",
  read: () => undefined,
  class: "thunderbird-widget",
  icon: iconByVariant("thunderbird", () => "thunderbird"),
  tooltip: () => "Mail (Thunderbird)",
  primary: () => {
    void launchScopedApp("thunderbird")
  },
}
