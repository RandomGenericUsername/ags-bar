import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const recording = readFileSync(
  fileURLToPath(new URL("../../bar/widgets/recording.tsx", import.meta.url)),
  "utf8",
)
const stylesheet = readFileSync(
  fileURLToPath(new URL("../../style.css", import.meta.url)),
  "utf8",
)
const app = readFileSync(
  fileURLToPath(new URL("../../app.tsx", import.meta.url)),
  "utf8",
)

test("the bar recording module does not own a cluster, popover or actions", () => {
  for (const forbidden of [
    "Gtk.Popover",
    "<popover",
    "rec-popup",
    "rec-dot",
    "rec-timer",
    "rec-btn",
    "hub.control",
    "formatElapsed",
    "state() === \"recording\" ? \"pause\"",
  ]) {
    assert.equal(
      recording.includes(forbidden),
      false,
      `recording.tsx must not contain ${forbidden}`,
    )
  }
})

test("the bar module keeps only visibility, the slot and the request client", () => {
  assert.match(recording, /domainEvents\.subscribe\("capture\.state"/)
  assert.match(recording, /anchorFromSlot/)
  assert.match(recording, /captureClusterIpc\s*\.\s*send/)
  assert.match(recording, /get_mapped\(\)/)
  assert.match(recording, /compute_bounds\(barWindow\)/)
  assert.match(recording, /set_can_target\(false\)/)
})

test("the old cluster CSS is deleted, not left as a duplicate", () => {
  for (const forbidden of [
    ".rec-cluster",
    ".rec-dot",
    ".rec-timer",
    ".rec-btn",
    ".rec-popup",
    "@keyframes rec-pulse",
  ]) {
    assert.equal(
      stylesheet.includes(forbidden),
      false,
      `style.css must not contain ${forbidden}`,
    )
  }
  assert.match(stylesheet, /\.recording-slot/)
})

test("popup-close forwards to capture's popover-close", () => {
  assert.match(app, /captureClusterIpc\.popoverClose\(\)/)
})
