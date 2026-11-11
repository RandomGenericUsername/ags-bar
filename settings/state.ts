// ---------------------------------------------------------------------------
// Reactive settings state (REQ-005).
//
// One module-scope value for the setting the UI reads and writes. The bar is a
// restart-mode app for APPEARANCE only; this UI setting applies live, so the
// state is a plain `createState`, not a restart request.
//
// The store is created once and loaded once at module evaluation. A failed save
// leaves the in-memory value applied and logs the write error: the switch must
// not lie about the state the user just chose while the disk is unwritable.
// ---------------------------------------------------------------------------

import { createState } from "ags"
import { glibBarSettingsStore } from "./glib-store"
import { mediaWidgetEnabled } from "./domain"

const store = glibBarSettingsStore()

const [enabled, setEnabled] = createState(mediaWidgetEnabled(store.load()))

/** Live "show the now-playing strip in the top bar". */
export { enabled as mediaWidgetEnabled }

export function setMediaWidgetEnabled(next: boolean): void {
  if (next === enabled()) return
  setEnabled(next)
  const error = store.save({ media_widget: { enabled: next } })
  if (error !== null) console.error(`ags-bar: media widget setting not saved: ${error}`)
}
