import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  TRANSPORT_SLOT_WIDTHS, transportZones, type TransportSurface,
} from "../../audio/presentation/transport-zones.ts"
import type { PlayerCapabilities } from "../../audio/domain/audio-model.ts"

/**
 * REQ-027 — fixed transport zones.
 *
 * Shuffle (left), previous/play/next (center) and repeat (right) keep their
 * slots whether or not the player supports them. The center controls must not
 * move when shuffle/repeat appear/disappear or when players are switched.
 */

const NONE: PlayerCapabilities = {
  canPlay: true, canPause: true, canPlayPause: true, canGoNext: false,
  canGoPrevious: false, canSeek: true, canShuffle: false, canLoop: false,
}

const BOTH: PlayerCapabilities = {
  ...NONE, canGoNext: true, canGoPrevious: true, canShuffle: true, canLoop: true,
}

const SURFACES: readonly TransportSurface[] = ["panel", "tray", "strip"]

function geometry(zones: ReturnType<typeof transportZones>): {
  order: string[]
  widths: number[]
  positions: number[]
} {
  const slots = [zones.left, ...zones.center, zones.right]
  const widths = slots.map((slot) => slot.width)
  const positions: number[] = []
  let x = 0
  for (const width of widths) {
    positions.push(x)
    x += width
  }
  return { order: slots.map((slot) => slot.key), widths, positions }
}

describe("REQ-027 transport zones", () => {
  for (const surface of SURFACES) {
    it(`${surface}: center geometry is identical with and without shuffle/repeat`, () => {
      const withSide = geometry(transportZones(surface, BOTH))
      const withoutSide = geometry(transportZones(surface, NONE))
      assert.deepEqual(withSide.order,
        ["shuffle", "previous", "play", "next", "repeat"])
      assert.deepEqual(withoutSide.widths, withSide.widths,
        "slot widths must not depend on capabilities")
      assert.deepEqual(withoutSide.positions, withSide.positions,
        "center positions must not shift when shuffle/repeat disappear")
      assert.deepEqual(withoutSide.order, withSide.order)
    })

    it(`${surface}: widths match the surface's compact/full sizes`, () => {
      const widths = TRANSPORT_SLOT_WIDTHS[surface]
      const zones = transportZones(surface, BOTH)
      assert.equal(zones.left.width, widths.side)
      assert.equal(zones.center[0].width, widths.side)
      assert.equal(zones.center[1].width, widths.play)
      assert.equal(zones.center[2].width, widths.side)
      assert.equal(zones.right.width, widths.side)
    })
  }

  it("hides only the icon when shuffle/repeat are unsupported", () => {
    const none = transportZones("panel", NONE)
    assert.equal(none.left.visible, false)
    assert.equal(none.right.visible, false)
    assert.equal(none.left.width, TRANSPORT_SLOT_WIDTHS.panel.side)
    assert.equal(none.right.width, TRANSPORT_SLOT_WIDTHS.panel.side)
    assert.deepEqual(none.center.map((slot) => slot.visible), [false, true, false])
  })

  it("keeps the center play slot centered between the fixed sides", () => {
    for (const surface of SURFACES) {
      for (const caps of [NONE, BOTH]) {
        const zones = transportZones(surface, caps)
        const leftEnd = zones.left.width
        const rightStart = leftEnd + zones.center.reduce((sum, slot) => sum + slot.width, 0)
        const play = zones.center[1]
        const playCenter = leftEnd + zones.center[0].width + play.width / 2
        const sideMid = (leftEnd + rightStart) / 2
        assert.equal(playCenter, sideMid, `${surface}: play slot is not centered`)
      }
    }
  })
})
