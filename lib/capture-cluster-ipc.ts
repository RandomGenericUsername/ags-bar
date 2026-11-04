// ---------------------------------------------------------------------------
// Live adapter for the bar's capture-cluster client.
//
// Kept out of `lib/cluster-request.ts` so that module stays pure and the stock
// runner can execute the exact argv/timeout/parse/coalescing logic without AGS.
// ---------------------------------------------------------------------------

import { execAsync } from "ags/process"
import { createCaptureClusterClient } from "./cluster-request"

export const captureClusterIpc = createCaptureClusterClient({
  exec: (argv) => execAsync([...argv]),
})
