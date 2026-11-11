import { Gtk } from "ags/gtk4"
import Pango from "gi://Pango?version=1.0"
import { Accessor, createComputed, createEffect, createState } from "ags"
import { registry } from "ags-platform/adapters/icon-registry"
import type { AudioAppRowView } from "../presentation/audio-panel-view-model"
import type { PlayerCapabilities } from "../domain/audio-model"
import type { AudioPanelBinding, TransportAction } from "../binding"

/**
 * Shared GTK controls for the sound panel, the bar strip and the tray dropdown.
 *
 * All three surfaces render the same player projection; keeping the transport,
 * seek line, level slider and menus here is what stops them disagreeing about
 * capability gating. They remain pure renderers: every command is dispatched
 * through the injected `AudioPanelBinding`.
 */

export const icon = (group: string, variant: string): string =>
  registry.resolve(group, variant) ?? ""

export function formatClock(us: number | null | undefined): string {
  if (us == null || !Number.isFinite(us) || us < 0) return "0:00"
  const seconds = Math.floor(us / 1_000_000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`
}

export function setImageOnce(image: Gtk.Image, path: string): void {
  const holder = image as Gtk.Image & { __audioImagePath?: string }
  if (!holder.__audioImagePath && !path) return
  if (holder.__audioImagePath === path) return
  holder.__audioImagePath = path
  image.set_from_file(path)
}

export function accessibleLabel(widget: Gtk.Widget, label: string): void {
  const accessible = widget as Gtk.Widget & {
    update_property?: (properties: Gtk.AccessibleProperty[], values: unknown[]) => void
  }
  accessible.update_property?.([Gtk.AccessibleProperty.LABEL], [label])
}

const resolve = <T,>(value: T | Accessor<T>): Accessor<T> =>
  createComputed(() => (typeof value === "function" ? (value as Accessor<T>)() : value))

export const clampPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)))
export const asPercent = (level: number): number => clampPercent(level * 100)

/** An icon button with a resolved file/name source and a reactive active state. */
export function IconButton({
  name,
  tooltip,
  imagePath,
  onClicked,
  active = false,
  visible = true,
  disabled = false,
  pixelSize = 18,
  className = "audio-icon-button",
}: {
  name: string | Accessor<string>
  tooltip: string | Accessor<string>
  imagePath: string | Accessor<string>
  onClicked: () => void
  active?: boolean | Accessor<boolean>
  visible?: boolean | Accessor<boolean>
  disabled?: boolean | Accessor<boolean>
  pixelSize?: number
  className?: string
}) {
  const label = resolve(name)
  const hint = resolve(tooltip)
  const path = resolve(imagePath)
  const isActive = resolve(active)
  const isVisible = resolve(visible)
  const isDisabled = resolve(disabled)
  return (
    <button
      class={createComputed(() => `${className}${isActive() ? " active" : ""}`)}
      visible={isVisible}
      sensitive={createComputed(() => !isDisabled())}
      tooltipText={hint}
      onClicked={onClicked}
      canFocus
      hasTooltip
      $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, label()))}
    >
      <image pixel_size={pixelSize} $={(self: Gtk.Image) => createEffect(() => setImageOnce(self, path()))} />
    </button>
  )
}

/**
 * A glyph button for MPRIS controls the registry has no art for.
 *
 * Shuffle/Loop are optional MPRIS properties and the icon artifact ships no
 * variants for them (adding art belongs to `dotfiles-assets`). A text glyph in
 * the same 40/24px button vocabulary is honest and keeps the control usable;
 * the tooltip and accessible label carry the real state.
 */
export function GlyphButton({
  glyph,
  name,
  tooltip,
  onClicked,
  active = false,
  visible = true,
  disabled = false,
  className = "audio-icon-button audio-glyph-button",
}: {
  glyph: string
  name: string | Accessor<string>
  tooltip: string | Accessor<string>
  onClicked: () => void
  active?: boolean | Accessor<boolean>
  visible?: boolean | Accessor<boolean>
  disabled?: boolean | Accessor<boolean>
  className?: string
}) {
  const label = resolve(name)
  const hint = resolve(tooltip)
  const isActive = resolve(active)
  const isVisible = resolve(visible)
  const isDisabled = resolve(disabled)
  return (
    <button
      class={createComputed(() => `${className}${isActive() ? " active" : ""}`)}
      visible={isVisible}
      sensitive={createComputed(() => !isDisabled())}
      tooltipText={hint}
      onClicked={onClicked}
      canFocus
      hasTooltip
      $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, label()))}
    >
      <label class="audio-glyph" label={glyph} />
    </button>
  )
}

/** A fixed-shape level slider; the value is written only after a committed interaction. */
export function LevelControl({
  label,
  volume,
  disabled = false,
  className = "audio-level-line",
  sliderClass = "settings-level-slider audio-level-slider",
  showValue = true,
  onChange,
}: {
  label: Accessor<string>
  volume: Accessor<{ level: number; muted: boolean }>
  disabled?: boolean | Accessor<boolean>
  className?: string
  sliderClass?: string
  /** Off when the caller renders its own value/Mixed column (Mixer rows). */
  showValue?: boolean
  onChange: (percent: number) => void
}) {
  let interacting = false
  const percent = createComputed(() => asPercent(volume().level))
  const isDisabled = resolve(disabled)

  function wireGestures(scale: Gtk.Scale) {
    const controllers = scale.observe_controllers()
    for (let i = 0; i < controllers.get_n_items(); i++) {
      const controller = controllers.get_item(i) as unknown as {
        constructor?: { $gtype?: { name?: string } }
        connect?: (signal: string, callback: () => void) => number
      } | null
      if (controller?.constructor?.$gtype?.name === "GtkGestureDrag") {
        controller.connect?.("drag-begin", () => { interacting = true })
        controller.connect?.("drag-end", () => {
          if (!interacting) return
          interacting = false
          onChange(scale.get_value())
        })
      } else if (controller?.constructor?.$gtype?.name === "GtkGestureClick") {
        controller.connect?.("pressed", () => { interacting = true })
        controller.connect?.("released", () => {
          if (!interacting) return
          interacting = false
          onChange(scale.get_value())
        })
      }
    }
    const keys = new Gtk.EventControllerKey()
    keys.connect("key-pressed", () => { interacting = true; return false })
    keys.connect("key-released", () => {
      if (!interacting) return
      interacting = false
      onChange(scale.get_value())
    })
    scale.add_controller(keys)
  }

  return (
    <box class={className} spacing={8}>
      <slider
        class={sliderClass}
        hexpand
        min={0}
        max={100}
        step={1}
        value={percent}
        drawValue={false}
        sensitive={createComputed(() => !isDisabled())}
        tooltipText={label}
        $={(self: Gtk.Scale) => {
          createEffect(() => accessibleLabel(self, `${label()} ${percent()} percent`))
          wireGestures(self)
        }}
      />
      <label class="audio-percent" visible={showValue} label={createComputed(() => isDisabled() ? "—" : `${percent()}%`)} />
    </box>
  )
}

/** The Playing page / tray dropdown seek line (2 px track, 9.5 px times). */
export function SeekLine({
  positionUs,
  durationUs,
  title,
  onCommit,
  compact = false,
  visible = true,
}: {
  positionUs: Accessor<number | null>
  durationUs: Accessor<number | null>
  title: Accessor<string>
  onCommit: (positionUs: number) => void
  compact?: boolean
  visible?: boolean | Accessor<boolean>
}) {
  const [seekValue, setSeekValue] = createState(0)
  let seeking = false
  const duration = createComputed(() => durationUs() ?? 0)
  const position = createComputed(() => positionUs() ?? 0)
  const enabled = createComputed(() => duration() > 0)
  createEffect(() => {
    if (seeking) return
    const total = duration()
    setSeekValue(total > 0 ? Math.max(0, Math.min(1000, (position() / total) * 1000)) : 0)
  })

  function commit(scale: Gtk.Scale) {
    if (!seeking) return
    seeking = false
    if (!enabled()) return
    onCommit(Math.round((scale.get_value() / 1000) * duration()))
  }

  function wire(scale: Gtk.Scale) {
    const controllers = scale.observe_controllers()
    for (let i = 0; i < controllers.get_n_items(); i++) {
      const controller = controllers.get_item(i) as unknown as {
        constructor?: { $gtype?: { name?: string } }
        connect?: (signal: string, callback: () => void) => number
      } | null
      if (controller?.constructor?.$gtype?.name === "GtkGestureDrag") {
        controller.connect?.("drag-begin", () => { seeking = true })
        controller.connect?.("drag-end", () => commit(scale))
      } else if (controller?.constructor?.$gtype?.name === "GtkGestureClick") {
        controller.connect?.("pressed", () => { seeking = true })
        controller.connect?.("released", () => commit(scale))
      }
    }
    const keys = new Gtk.EventControllerKey()
    keys.connect("key-pressed", () => { seeking = true; return false })
    keys.connect("key-released", () => commit(scale))
    scale.add_controller(keys)
  }

  return (
    <box class={`audio-seek${compact ? " compact" : ""}`} orientation={Gtk.Orientation.VERTICAL} spacing={0} visible={visible}>
      <slider
        class="settings-level-slider audio-seek-slider"
        hexpand
        min={0}
        max={1000}
        step={1}
        value={seekValue}
        drawValue={false}
        sensitive={enabled}
        tooltipText={createComputed(() => `${title()} position ${formatClock(position())} of ${formatClock(duration())}`)}
        onNotifyValue={(self: Gtk.Scale) => setSeekValue(Math.round(self.get_value()))}
        $={(self: Gtk.Scale) => {
          createEffect(() => accessibleLabel(self, `${title()} playback position, ${formatClock(position())} of ${formatClock(duration())}`))
          wire(self)
        }}
      />
      <box class="audio-times">
        <label class="audio-time" xalign={0} hexpand label={createComputed(() => formatClock(position()))} />
        <label class="audio-time" xalign={1} label={createComputed(() => formatClock(duration()))} />
      </box>
    </box>
  )
}

/** A 40/28 px app tile: real artwork when present, then the app icon, then the initial. */
export function AppTile({
  row,
  size,
  className = "",
}: {
  row: Accessor<AudioAppRowView>
  size: number
  className?: string
}) {
  const artworkPath = createComputed(() => row().artworkPath || "")
  const appIconPath = createComputed(() => icon("app-icons", row().iconName || "application-x-executable"))
  const initial = createComputed(() => row().appName.slice(0, 1).toUpperCase())
  return (
    <box class={`audio-app-tile ${className}`.trim()} widthRequest={size} heightRequest={size}>
      <image
        class="audio-app-tile-image"
        pixel_size={size}
        $={(self: Gtk.Image) => createEffect(() => setImageOnce(self, artworkPath() || appIconPath()))}
      />
      <label
        class="audio-app-tile-fallback"
        label={initial}
        visible={createComputed(() => !artworkPath() && !appIconPath())}
      />
    </box>
  )
}

/**
 * The one transport row. Capability-gated per player, so a live page hides
 * Previous/Next and both Shuffle/Loop exactly as the mock's VLC page does.
 */
export function TransportRow({
  row,
  binding,
  className = "audio-transport",
  compact = false,
  playSize = 34,
  iconSize = 16,
}: {
  row: Accessor<AudioAppRowView>
  binding: AudioPanelBinding
  className?: string
  compact?: boolean
  /** The filled `media-transport-panel` art is the play button's circle; its pixel size is the button size. */
  playSize?: number
  iconSize?: number
}) {
  const appName = createComputed(() => row().appName)
  const playerId = createComputed(() => row().playerId)
  const capabilities = createComputed<PlayerCapabilities>(() => row().capabilities)
  const playing = createComputed(() => row().playback === "playing")
  const dispatch = (action: TransportAction) => {
    const id = playerId()
    if (id) binding.actions.playerAction(id, action)
  }

  return (
    <box class={className} spacing={compact ? 0 : 1}>
      <IconButton
        name={createComputed(() => `Previous in ${appName()}`)}
        tooltip="Previous"
        imagePath={icon("media-transport", "previous")}
        visible={createComputed(() => capabilities().canGoPrevious)}
        onClicked={() => dispatch("previous")}
        pixelSize={iconSize}
        className="audio-icon-button audio-transport-button"
      />
      <IconButton
        name={createComputed(() => `${playing() ? "Pause" : "Play"} ${appName()}`)}
        tooltip={createComputed(() => (playing() ? "Pause" : "Play"))}
        imagePath={createComputed(() => icon("media-transport-panel", playing() ? "pause" : "play"))}
        visible={createComputed(() => capabilities().canPlayPause)}
        onClicked={() => dispatch("play-pause")}
        active={playing}
        pixelSize={playSize}
        className="audio-icon-button audio-transport-button play"
      />
      <IconButton
        name={createComputed(() => `Next in ${appName()}`)}
        tooltip="Next"
        imagePath={icon("media-transport", "next")}
        visible={createComputed(() => capabilities().canGoNext)}
        onClicked={() => dispatch("next")}
        pixelSize={iconSize}
        className="audio-icon-button audio-transport-button"
      />
      <GlyphButton
        glyph="⇄"
        name={createComputed(() => `Shuffle ${row().shuffle ? "on" : "off"} for ${appName()}`)}
        tooltip={createComputed(() => (row().shuffle ? "Shuffle on" : "Shuffle off"))}
        visible={createComputed(() => capabilities().canShuffle)}
        active={createComputed(() => row().shuffle)}
        onClicked={() => { const id = playerId(); if (id) binding.actions.toggleShuffle(id) }}
        className="audio-icon-button audio-transport-button audio-glyph-button"
      />
      <GlyphButton
        glyph="↻"
        name={createComputed(() => `Repeat ${row().loop} for ${appName()}`)}
        tooltip={createComputed(() => {
          const loop = row().loop
          return loop === "track" ? "Repeat one" : loop === "playlist" ? "Repeat all" : "Repeat off"
        })}
        visible={createComputed(() => capabilities().canLoop)}
        active={createComputed(() => row().loop !== "none")}
        onClicked={() => { const id = playerId(); if (id) binding.actions.cycleLoop(id) }}
        className="audio-icon-button audio-transport-button audio-glyph-button"
      />
    </box>
  )
}

export interface MenuOption {
  label: string
  note?: string
  selected: boolean
  disabled?: boolean
  activate: () => void
}

/**
 * A menu-like picker popover (device, input, route).
 *
 * Unlike the previous filter-to-available list, unavailable entries stay
 * visible and disabled: the paper's unavailable-output branch must be an honest
 * no-op, not a silently shorter menu.
 */
export function openChoicePopover(anchor: Gtk.Widget, title: string, options: MenuOption[]): void {
  const popover = new Gtk.Popover({ autohide: true })
  popover.set_has_arrow(false)
  popover.add_css_class("audio-menu")
  popover.set_parent(anchor)
  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1 })
  const heading = new Gtk.Label({ label: title, xalign: 0 })
  heading.add_css_class("audio-menu-heading")
  list.append(heading)
  for (const option of options) {
    const button = new Gtk.Button({
      css_classes: ["audio-menu-option", ...(option.selected ? ["selected"] : [])],
      focusable: true,
      tooltip_text: option.disabled ? `${option.label} · Unavailable` : option.label,
    })
    button.sensitive = !option.disabled
    const row = new Gtk.Box({ spacing: 8 })
    const mark = new Gtk.Label({ label: option.selected ? "✓" : "", xalign: 0 })
    mark.add_css_class("audio-option-mark")
    const name = new Gtk.Label({ label: option.label, xalign: 0, hexpand: true, ellipsize: Pango.EllipsizeMode.END })
    row.append(mark)
    row.append(name)
    if (option.note) {
      const note = new Gtk.Label({ label: option.note, xalign: 1 })
      note.add_css_class("audio-menu-note")
      row.append(note)
    }
    button.set_child(row)
    accessibleLabel(button, `${option.label}${option.selected ? ", selected" : ""}${option.disabled ? ", unavailable" : ""}`)
    button.connect("clicked", () => {
      if (option.disabled) return
      option.activate()
      popover.popdown()
    })
    list.append(button)
  }
  popover.set_child(list)
  popover.connect("closed", () => {
    popover.unparent()
    anchor.grab_focus()
  })
  popover.popup()
}
