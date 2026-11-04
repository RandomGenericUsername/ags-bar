// ---------------------------------------------------------------------------
// Live adapter for the bar's capture-cluster client.
//
// Kept out of `lib/cluster-request.ts` so that module stays pure and the stock
// runner can execute the exact argv/timeout/parse/coalescing logic without AGS.
//
// GJS has no DOM `setTimeout`; the timeout race must use GLib. The handle is a
// small object rather than the raw source id so clearing a source that already
// fired cannot log a `source_remove` critical.
// ---------------------------------------------------------------------------

import GLib from "gi://GLib?version=2.0"
import { execAsync } from "ags/process"
import {
  createCaptureClusterClient,
  type ClusterTimers,
} from "./cluster-request"

interface GlibTimer {
  id: number
  done: boolean
}

const glibTimers: ClusterTimers = {
  setTimeout(callback, milliseconds) {
    const handle: GlibTimer = { id: 0, done: false }
    handle.id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
      handle.done = true
      callback()
      return false
    })
    return handle
  },
  clearTimeout(value) {
    const handle = value as GlibTimer
    if (handle.done) return
    handle.done = true
    GLib.source_remove(handle.id)
  },
}

export const captureClusterIpc = createCaptureClusterClient({
  exec: (argv) => execAsync([...argv]),
  timers: glibTimers,
})
