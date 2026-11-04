// ---------------------------------------------------------------------------
// The bar's recording-cluster adapter (SPIKE-003 option B).
//
// The bar no longer draws the cluster, owns the timer, opens a popover or sends
// Pause/Resume/Stop. It keeps:
//   * a `capture.state` subscription for visibility,
//   * a transparent slot reservation,
//   * one measurement of that slot,
//   * the request client that asks the capture process to draw at that rect.
//
// The capture instance owns the window, timer, popover and actions. There is no
// duplicate fallback: if capture is down, this slot stays empty and one failure
// is logged.
// ---------------------------------------------------------------------------

import GLib from "gi://GLib?version=2.0"
import type Gdk from "gi://Gdk?version=4.0"
import { createEffect, createState } from "ags"
import { Gtk } from "ags/gtk4"
import { domainEvents } from "ags-platform/adapters/event-bus"
import { preferences } from "ags-platform/adapters/preferences"
import type {
  ClusterAnchor,
  ClusterObserved,
  ClusterResponse,
} from "ags-platform/ports/capture-cluster"
import type { RichWidgetSpec } from "../../kit/widget"
import {
  anchorFromSlot,
  clusterRequest,
  slotSize,
  type MonitorFrame,
} from "../../domain/cluster-slot"
import { captureClusterIpc } from "../../lib/capture-cluster-ipc"

type RecordingState = "idle" | "recording" | "paused"
type DispatchKind = "show" | "update" | "hide"

const RETRY_DELAYS = [250, 1000, 2000]
const DEBOUNCE_MS = 100
const EDGE = "top" as const

function recordingState(payload: Record<string, unknown>): RecordingState {
  const next = payload.state
  return next === "recording" || next === "paused" ? next : "idle"
}

function sameAnchor(left: ClusterAnchor | null, right: ClusterAnchor): boolean {
  if (left === null) return false
  return (
    left.connector === right.connector &&
    left.monitorX === right.monitorX &&
    left.monitorY === right.monitorY &&
    left.monitorWidth === right.monitorWidth &&
    left.monitorHeight === right.monitorHeight &&
    left.scale === right.scale &&
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height &&
    left.edge === right.edge
  )
}

export function createRecordingWidget(monitor: Gdk.Monitor): RichWidgetSpec<RecordingState> {
  const [state, setState] = createState<RecordingState>("idle")
  const compact = preferences.get("capture-tool", "bar_compact_controls", false)
  const monitorFrame: MonitorFrame = {
    connector: monitor.get_connector() ?? null,
    x: monitor.get_geometry().x,
    y: monitor.get_geometry().y,
    width: monitor.get_geometry().width,
    height: monitor.get_geometry().height,
    scale: monitor.get_scale_factor(),
  }

  let reserve: Gtk.Box | null = null
  let root: Gtk.Widget | null = null
  let barWindow: Gtk.Widget | null = null
  let rootWired = false
  let debounce: number | null = null
  let retry: number | null = null
  let retryAttempt = 0
  let loggedFailure = false
  let jobId: string | null = null
  let baseElapsed = 0
  let syncedAtMs = Date.now()
  let seq = 0
  let shown = false
  let lastAnchor: ClusterAnchor | null = null
  let lastCompact: boolean | null = null
  let disposed = false

  function nextSeq(): number {
    seq += 1
    return seq
  }

  function observed(): ClusterObserved {
    const phase = state()
    const liveElapsed =
      phase === "recording"
        ? baseElapsed + Math.floor((Date.now() - syncedAtMs) / 1000)
        : baseElapsed
    return {
      phase,
      jobId,
      elapsedSeconds: Math.max(0, liveElapsed),
    }
  }

  function cancelDebounce(): void {
    if (debounce !== null) {
      GLib.source_remove(debounce)
      debounce = null
    }
  }

  function cancelRetry(): void {
    if (retry !== null) {
      GLib.source_remove(retry)
      retry = null
    }
  }

  function reportOnce(message: string): void {
    if (loggedFailure) return
    loggedFailure = true
    console.warn(`[bar] recording cluster: ${message}`)
  }

  function dispatch(
    request: ReturnType<typeof clusterRequest>,
    kind: DispatchKind,
  ): void {
    cancelRetry()
    void captureClusterIpc.send(request).then((result: ClusterResponse) => {
      if (result.ok) {
        retryAttempt = 0
        return
      }

      if (kind === "hide" || !result.retryable) {
        reportOnce(`${result.error} on ${kind}`)
        return
      }

      if (retryAttempt >= RETRY_DELAYS.length) {
        reportOnce(`${result.error} on ${kind} after retries`)
        if (kind === "update" && shown && lastAnchor !== null) {
          shown = false
          const anchor = lastAnchor
          lastAnchor = null
          dispatch(clusterRequest("hide", nextSeq(), false, anchor, undefined), "hide")
        }
        return
      }

      const delay = RETRY_DELAYS[retryAttempt] ?? RETRY_DELAYS[2]
      retryAttempt += 1
      retry = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
        retry = null
        if (!disposed) dispatch(request, kind)
        return false
      })
    })
  }

  function measure(): ClusterAnchor | null {
    if (!root || !barWindow || !root.get_mapped()) return null
    const [ok, bounds] = root.compute_bounds(barWindow)
    if (!ok) return null
    return anchorFromSlot(
      {
        x: bounds.get_x(),
        y: bounds.get_y(),
        width: bounds.get_width(),
        height: bounds.get_height(),
      },
      monitorFrame,
      EDGE,
    )
  }

  function hideCurrent(): void {
    if (!shown || lastAnchor === null) return
    shown = false
    const anchor = lastAnchor
    lastAnchor = null
    lastCompact = null
    dispatch(clusterRequest("hide", nextSeq(), false, anchor, undefined), "hide")
  }

  function sync(): void {
    if (disposed) return
    if (state() === "idle") {
      hideCurrent()
      return
    }
    if (!ensureRoot()) return
    const anchor = measure()
    if (anchor === null) {
      hideCurrent()
      return
    }

    const compactNow = compact()
    if (!shown) {
      shown = true
      lastAnchor = anchor
      lastCompact = compactNow
      retryAttempt = 0
      dispatch(
        clusterRequest("show", nextSeq(), compactNow, anchor, observed()),
        "show",
      )
      return
    }

    if (!sameAnchor(lastAnchor, anchor) || lastCompact !== compactNow) {
      lastAnchor = anchor
      lastCompact = compactNow
      retryAttempt = 0
      dispatch(
        clusterRequest("update", nextSeq(), compactNow, anchor, observed()),
        "update",
      )
    }
  }

  function schedule(delay = DEBOUNCE_MS): void {
    if (disposed) return
    cancelDebounce()
    debounce = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
      debounce = null
      sync()
      return false
    })
  }

  function wireRoot(): boolean {
    if (rootWired) return root !== null
    if (!reserve) return false
    const parent = reserve.get_parent()
    if (!parent) return false
    root = parent
    barWindow = root.get_root() as Gtk.Widget | null
    if (!barWindow) {
      root = null
      return false
    }
    rootWired = true
    root.connect("map", () => schedule(0))
    root.connect("unmap", () => {
      cancelDebounce()
      hideCurrent()
    })
    root.connect("notify::width", () => schedule(50))
    root.connect("notify::height", () => schedule(50))
    root.connect("destroy", () => {
      disposed = true
      cancelDebounce()
      cancelRetry()
      hideCurrent()
    })
    return true
  }

  function ensureRoot(): boolean {
    if (rootWired) return root !== null
    return wireRoot()
  }

  // The spacer reserves the cluster's footprint. `.widget` adds the bar's
  // existing 0 8px padding around it; the measured allocation (not this
  // spacer) is what the capture process receives.
  createEffect(() => {
    const size = slotSize(compact())
    reserve?.set_size_request(size.width, size.height)
    schedule(0)
  })

  domainEvents.subscribe("capture.state", (_topic, payload) => {
    const next = recordingState(payload as Record<string, unknown>)
    const nextJob = typeof payload.job_id === "string" ? payload.job_id : null
    if (nextJob !== jobId) {
      loggedFailure = false
      retryAttempt = 0
    }
    baseElapsed = Number(payload.elapsed_seconds) || 0
    syncedAtMs = Date.now()
    jobId = nextJob
    setState(next)
    if (next === "idle") {
      cancelDebounce()
      hideCurrent()
    } else {
      schedule(0)
    }
  })

  // A hub restart invalidates the old job. The bus re-hydrates afterwards.
  domainEvents.onRestart(() => {
    jobId = null
    baseElapsed = 0
    syncedAtMs = Date.now()
    retryAttempt = 0
    loggedFailure = false
    setState("idle")
    cancelDebounce()
    hideCurrent()
  })

  return {
    id: "recording",
    read: () => state(),
    visible: (value) => value !== "idle",
    class: "recording-slot",
    content: () => {
      const size = slotSize(compact())
      return (
        <box
          class="recording-slot-reserve"
          widthRequest={size.width}
          heightRequest={size.height}
          $={(self) => {
            reserve = self
            self.set_size_request(size.width, size.height)
            self.set_can_target(false)
            wireRoot()
            schedule(0)
          }}
        />
      )
    },
  }
}
