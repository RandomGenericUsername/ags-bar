#!/usr/bin/env node
// REQ-026 — long-label truncation on the v0.6.32 display-clock candidate.
//
// Widget-level `maxWidthChars` + `Pango.EllipsizeMode.END` keep the fixed
// 352 px panel / 300 px tray from growing with a long Thanatos/Neon Genesis
// title. The skin is not touched, and the Mixer is not modified.

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const AUDIO = join(ROOT, "audio")
const read = (path) => readFileSync(path, "utf8")

function labelTags(source, className) {
  return [...source.matchAll(/<label\b[^>]*class="([^"]*)"[^>]*>/g)]
    .filter((match) => match[1].split(/\s+/).includes(className))
    .map((match) => match[0])
}

function assertTruncated(source, className, file) {
  const tags = labelTags(source, className)
  assert.ok(tags.length > 0, `${file}: no .${className} label found`)
  for (const tag of tags) {
    assert.match(tag, /maxWidthChars=\{\d+\}/, `${file}: .${className} has no maxWidthChars`)
    assert.match(tag, /ellipsize=\{Pango\.EllipsizeMode\.END\}/,
      `${file}: .${className} does not ellipsize at the end`)
  }
}

test("panel now-playing app/title/artist labels are width-capped", () => {
  const popup = read(join(AUDIO, "AudioPopup.tsx"))
  const page = popup.slice(popup.indexOf("function PlayingPage"), popup.indexOf("function PlayingDeck"))
  for (const className of ["audio-app-name", "audio-track-title", "audio-track-artist"]) {
    assertTruncated(page, className, "AudioPopup.tsx PlayingPage")
  }
})

test("tray now-playing and Players-row labels are width-capped", () => {
  const tray = read(join(AUDIO, "TrayPopup.tsx"))
  for (const className of [
    "audio-tray-source-name", "audio-tray-title", "audio-tray-artist",
    "audio-tray-player-name", "audio-tray-player-track",
  ]) {
    assertTruncated(tray, className, "TrayPopup.tsx")
  }
})

test("the long-title tooltip is retained on both surfaces", () => {
  const popup = read(join(AUDIO, "AudioPopup.tsx"))
  const tray = read(join(AUDIO, "TrayPopup.tsx"))
  assert.match(popup, /class="audio-track-title"[^>]*tooltipText=\{title\}/,
    "the panel title lost its full-text tooltip")
  assert.match(tray, /class="audio-tray-title"[^>]*tooltipText=\{title\}/,
    "the tray title lost its full-text tooltip")
})

test("the fixed surface widths remain 352 px (panel) and 300 px (tray)", () => {
  const popup = read(join(AUDIO, "AudioPopup.tsx"))
  const tray = read(join(AUDIO, "TrayPopup.tsx"))
  assert.match(popup, /width:\s*352/, "the panel width changed")
  assert.match(tray, /width:\s*300/, "the tray width changed")
})

test("no skin or stylesheet width rule was introduced", () => {
  const css = read(join(AUDIO, "audio-panel.css"))
  assert.doesNotMatch(css, /audio-track-title\s*\{[^}]*max-width/s,
    "a CSS width rule replaced the widget cap")
})
