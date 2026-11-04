import { test } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_RECORDING_CONTROLS,
  isTopBarControls,
} from "../../domain/recording-presentation.ts"

test("the bar defaults to the top-bar surface", () => {
  assert.equal(DEFAULT_RECORDING_CONTROLS, "top-bar")
  assert.equal(isTopBarControls("top-bar"), true)
})

test("only the top-bar value reserves the bar slot", () => {
  assert.equal(isTopBarControls("hover"), false)
  assert.equal(isTopBarControls("always"), false)
  assert.equal(isTopBarControls("hidden"), false)
  assert.equal(isTopBarControls(undefined), false)
  assert.equal(isTopBarControls(1), false)
})
