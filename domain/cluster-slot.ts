// ---------------------------------------------------------------------------
// PURE: the bar's recording-cluster slot (SPIKE-003 option B).
//
// The bar measures its own widget allocation and sends that rect to the capture
// process. Every coordinate here is MONITOR-LOCAL LOGICAL pixels: GDK, GTK
// allocation and gtk4-layer-shell margins all use the same space. The monitor
// geometry is carried only as a fallback identity, never as an origin to add.
//
// The spacer sizes are the only presentation constants left in the bar. They
// reserve the same visual footprint the capture-drawn cluster expects; the
// measured allocation (which includes the `.widget` padding) is what is sent.
// ---------------------------------------------------------------------------

import {
  CAPTURE_CLUSTER_VERSION,
  type ClusterAnchor,
  type ClusterCommand,
  type ClusterEdge,
  type ClusterObserved,
  type ClusterRequest,
} from "ags-platform/ports/capture-cluster"

export interface MonitorFrame {
  readonly connector: string | null
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly scale: number
}

export interface SlotBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface SlotSize {
  readonly width: number
  readonly height: number
}

/** Compact bar card (109px) + its 4px right margin. */
export const COMPACT_SLOT: SlotSize = { width: 113, height: 44 }

/** Full bar card (161px) + its 4px right margin. */
export const FULL_SLOT: SlotSize = { width: 165, height: 44 }

export function slotSize(compact: boolean): SlotSize {
  return compact ? COMPACT_SLOT : FULL_SLOT
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

/**
 * Turn a widget allocation into the payload anchor, or null when there is no
 * usable slot. A null result means "send no request", never "send 0x0".
 */
export function anchorFromSlot(
  bounds: SlotBounds,
  monitor: MonitorFrame,
  edge: ClusterEdge,
): ClusterAnchor | null {
  const x = Math.round(bounds.x)
  const y = Math.round(bounds.y)
  const width = Math.round(bounds.width)
  const height = Math.round(bounds.height)

  if (
    !finite(x) ||
    !finite(y) ||
    !finite(width) ||
    !finite(height) ||
    !finite(monitor.width) ||
    !finite(monitor.height) ||
    !finite(monitor.scale) ||
    width <= 0 ||
    height <= 0 ||
    monitor.width <= 0 ||
    monitor.height <= 0 ||
    monitor.scale <= 0
  ) {
    return null
  }

  // A slot that starts outside the monitor or overflows it is a measurement
  // failure, not a position capture should clamp on our behalf.
  if (x < 0 || y < 0 || x + width > monitor.width || y + height > monitor.height) {
    return null
  }

  return {
    connector: monitor.connector,
    monitorX: monitor.x,
    monitorY: monitor.y,
    monitorWidth: monitor.width,
    monitorHeight: monitor.height,
    scale: monitor.scale,
    x,
    y,
    width,
    height,
    edge,
  }
}

/** Build one versioned request. The widget owns `seq`; this only shapes it. */
export function clusterRequest(
  command: ClusterCommand,
  seq: number,
  compact: boolean,
  anchor: ClusterAnchor | undefined,
  observed: ClusterObserved | undefined,
): ClusterRequest {
  return {
    v: CAPTURE_CLUSTER_VERSION,
    command,
    seq,
    compact,
    ...(anchor !== undefined ? { anchor } : {}),
    ...(observed !== undefined ? { observed } : {}),
  }
}

/** The global Esc path: close whichever cluster popover is open. */
export function popoverCloseRequest(seq: number): ClusterRequest {
  return clusterRequest("popover-close", seq, false, undefined, undefined)
}
