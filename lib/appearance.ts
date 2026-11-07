// ---------------------------------------------------------------------------
// The bar's ONE Generations v3 Appearance instance.
//
// Every consumer (app startup, the settings surface and the Bluetooth lists)
// must share this instance. `value()` subscribes to the single watched
// `$XDG_STATE_HOME/dotfiles/current` pointer, so a second `createAppearance()`
// would add a second watcher and a second provider for the same app. The app is
// restart-only, so `main()` calls `apply()` once and the appearance change
// itself is picked up by the runtime's serialized restart lane.
// ---------------------------------------------------------------------------

import { createAppearance } from "ags-platform/adapters/appearance"

export const appearance = createAppearance({ configDir: "ags" })
