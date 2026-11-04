import { test } from "node:test"
import assert from "node:assert/strict"
import {
  anchorFromSlot,
  clusterRequest,
  COMPACT_SLOT,
  FULL_SLOT,
  popoverCloseRequest,
  slotSize,
  type MonitorFrame,
} from "../../domain/cluster-slot.ts"

const monitor: MonitorFrame = {
  connector: "eDP-1",
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  scale: 1,
}

test("compact and full slots reserve the documented footprints", () => {
  assert.deepEqual(slotSize(true), COMPACT_SLOT)
  assert.deepEqual(slotSize(false), FULL_SLOT)
  assert.deepEqual(COMPACT_SLOT, { width: 113, height: 44 })
  assert.deepEqual(FULL_SLOT, { width: 165, height: 44 })
})

test("a measured allocation becomes a monitor-local anchor", () => {
  assert.deepEqual(
    anchorFromSlot({ x: 1546.4, y: 10.2, width: 76.5, height: 38.4 }, monitor, "top"),
    {
      connector: "eDP-1",
      monitorX: 0,
      monitorY: 0,
      monitorWidth: 1920,
      monitorHeight: 1080,
      scale: 1,
      x: 1546,
      y: 10,
      width: 77,
      height: 38,
      edge: "top",
    },
  )
})

test("a negative monitor origin stays in the payload, never in the slot", () => {
  const anchor = anchorFromSlot(
    { x: 12, y: 8, width: 76, height: 38 },
    { ...monitor, connector: "HDMI-A-1", x: -1920 },
    "top",
  )
  assert.equal(anchor?.monitorX, -1920)
  assert.equal(anchor?.x, 12)
})

test("the bar's edge travels with the slot", () => {
  const anchor = anchorFromSlot(
    { x: 12, y: 1000, width: 243, height: 46 },
    monitor,
    "bottom",
  )
  assert.equal(anchor?.edge, "bottom")
})

test("zero, off-monitor or overflowing slots are null, never 0x0 requests", () => {
  for (const bounds of [
    { x: 0, y: 0, width: 0, height: 38 },
    { x: 0, y: 0, width: 76, height: 0 },
    { x: -1, y: 0, width: 76, height: 38 },
    { x: 0, y: -1, width: 76, height: 38 },
    { x: 1900, y: 0, width: 76, height: 38 },
    { x: 0, y: 1050, width: 76, height: 38 },
    { x: 0, y: 0, width: Number.NaN, height: 38 },
  ]) {
    assert.equal(anchorFromSlot(bounds, monitor, "top"), null)
  }
  assert.equal(
    anchorFromSlot(
      { x: 0, y: 0, width: 76, height: 38 },
      { ...monitor, scale: 0 },
      "top",
    ),
    null,
  )
})

test("requests carry the version and only the fields that apply", () => {
  const anchor = anchorFromSlot(
    { x: 10, y: 10, width: 76, height: 38 },
    monitor,
    "top",
  )!
  assert.deepEqual(clusterRequest("show", 4, true, anchor, { phase: "recording" }), {
    v: 1,
    command: "show",
    seq: 4,
    compact: true,
    anchor,
    observed: { phase: "recording" },
  })
  assert.deepEqual(popoverCloseRequest(9), {
    v: 1,
    command: "popover-close",
    seq: 9,
    compact: false,
  })
})
