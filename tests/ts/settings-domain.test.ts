import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_BAR_SETTINGS,
  SETTINGS_RELATIVE_PATH,
  barSettingsRecord,
  defaultBarSettings,
  mediaWidgetEnabled,
  mergeBarSettings,
} from "../../settings/domain.ts"

/**
 * The bar's app-owned settings domain (REQ-005).
 *
 * The file is `$XDG_CONFIG_HOME/ags-bar/config.json` with
 * `{ media_widget: { enabled } }`. The adapter owns `$XDG_CONFIG_HOME`; this
 * suite owns the merge rules: a missing or corrupt record degrades to the
 * default, `false` is a real value, and the written shape cannot widen.
 */

describe("settings domain", () => {
  it("names the app-owned file, never the AGS install link or the capture config", () => {
    assert.equal(SETTINGS_RELATIVE_PATH, "ags-bar/config.json")
    assert.ok(!SETTINGS_RELATIVE_PATH.startsWith("ags/"), "the AGS config link is read-only")
    assert.ok(!SETTINGS_RELATIVE_PATH.includes("clipboard"))
    assert.ok(!SETTINGS_RELATIVE_PATH.endsWith("bar.json"), "the layout file is not settings")
  })

  it("defaults the media widget on", () => {
    assert.equal(DEFAULT_BAR_SETTINGS.media_widget.enabled, true)
    assert.equal(mediaWidgetEnabled(defaultBarSettings()), true)
  })

  it("degrades a missing, corrupt or wrong-typed record to the default", () => {
    for (const raw of [null, undefined, {}, [], "nope", 4, { media_widget: null }]) {
      assert.equal(mergeBarSettings(raw).media_widget.enabled, true, `raw=${JSON.stringify(raw)}`)
    }
    assert.equal(mergeBarSettings({ media_widget: { enabled: "false" } }).media_widget.enabled, true)
    assert.equal(mergeBarSettings({ media_widget: { enabled: 0 } }).media_widget.enabled, true)
  })

  it("preserves an explicit false", () => {
    assert.equal(mergeBarSettings({ media_widget: { enabled: false } }).media_widget.enabled, false)
  })

  it("writes only the owned shape", () => {
    assert.deepEqual(barSettingsRecord({ media_widget: { enabled: false } }), {
      media_widget: { enabled: false },
    })
    assert.deepEqual(Object.keys(barSettingsRecord(defaultBarSettings())), ["media_widget"])
  })

  it("returns a fresh default object so a caller cannot mutate the constant", () => {
    const settings = defaultBarSettings()
    settings.media_widget.enabled = false
    assert.equal(DEFAULT_BAR_SETTINGS.media_widget.enabled, true)
  })
})
