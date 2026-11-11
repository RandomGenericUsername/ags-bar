import { Gtk, Gdk } from "ags/gtk4"
import Pango from "gi://Pango?version=1.0"
import { Accessor, For, With, createComputed, createEffect } from "ags"
import { close, popupVisible, audioIconX } from "./ui-state"
import { levelVariant } from "./presentation/levels"
import type {
  AudioAppRowView,
  AudioInputConsumerView,
  AudioPanelViewModel,
} from "./presentation/audio-panel-view-model"
import type { EndpointState } from "./domain/audio-model"
import type { AudioPanelBinding } from "./binding"
import {
  AppTile,
  IconButton,
  LevelControl,
  SeekLine,
  TransportRow,
  asPercent,
  icon,
  openChoicePopover,
  setImageOnce,
  accessibleLabel,
} from "./ui/controls"
import {
  chooseDeckMode,
  cyclePlaying,
  deckMode,
  inputOpen,
  mixerFocusId,
  openMixerFor,
  playingId,
  reconcilePlaying,
  resolveDeckMode,
  settingsOpen,
  setSettingsOpenState,
  toggleInputOpen,
} from "./panel-state"
import { mediaWidgetEnabled, setMediaWidgetEnabled } from "../settings/state"
import { PopupCatcher, PopupHost, type PopupSurfaceSpec } from "../kit/popup-host"

/**
 * The sound panel (REQ-005).
 *
 * One 352 px anchored popover with a persistent Output header, a
 * `Playing | Mixer` deck and a collapsed Input section. The panel owns no audio
 * policy: it renders `AudioPanelBinding.model` and dispatches
 * `AudioPanelBinding.actions`.
 *
 * Surface roles (customization layer, doc 113 W-10): this is an AGS
 * layer-shell overlay, so its chrome is `surface.panel` — never
 * `surface.window`. Rows are cells, the Playing page is a card, buttons are
 * controls and badges are pills; `audio/audio-panel.css` carries the palette
 * roles today and the skin template maps these classes in a follow-up.
 *
 * Re-exported for the composition root (it imports these from this module).
 */
export type { AudioPanelActions, AudioPanelBinding, RouteChoice, TransportAction } from "./binding"

const VERTICAL = Gtk.Orientation.VERTICAL
const WHEEL_COOLDOWN_MS = 250

// ---------------------------------------------------------------------------
// Output — the persistent hero. It lives OUTSIDE the deck scroller, so the
// master device/level/mute never scroll away.
// ---------------------------------------------------------------------------

function DeviceSelector({
  title,
  value,
  selectedId,
  disabled,
  devices,
  onSelect,
  iconName,
  fallbackVariant = "system-low",
  summary = false,
}: {
  title: string
  value: Accessor<string>
  selectedId: Accessor<string | null>
  disabled: Accessor<boolean>
  devices: Accessor<readonly EndpointState[]>
  onSelect: (id: string) => void
  iconName: string
  fallbackVariant?: string
  /** True for the Input row (no "Default" note). */
  summary?: boolean
}) {
  return (
    <button
      class="audio-device"
      hexpand
      sensitive={createComputed(() => !disabled())}
      tooltipText={value}
      onClicked={(self: Gtk.Button) => {
        const currentId = selectedId()
        const options = devices().map((device) => ({
          label: device.name,
          note: device.available ? (device.id === currentId ? "Selected" : "") : "Unavailable",
          selected: device.id === currentId,
          disabled: !device.available,
          activate: () => onSelect(device.id),
        }))
        if (options.length === 0) return
        openChoicePopover(self, title, options)
      }}
      $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, `${title}: ${value()}`))}
    >
      <box spacing={9} hexpand>
        <image pixel_size={17} class="audio-device-icon" $={(self: Gtk.Image) => setImageOnce(self, icon(iconName, fallbackVariant))} />
        <label class="audio-device-name" xalign={0} hexpand ellipsize={Pango.EllipsizeMode.END} label={value} />
        {summary ? null : <label class="audio-device-note" label="Default" />}
        <label class="audio-device-chevron" label="▾" />
      </box>
    </button>
  )
}

function OutputHero({ binding }: { binding: AudioPanelBinding }) {
  const model = createComputed(() => binding.model())
  const output = createComputed<EndpointState | null>(() => {
    const state = model()
    return state.outputs.find((item) => item.id === state.preferredOutputId) ?? null
  })
  const name = createComputed(() => output()?.name ?? "No output available")
  const available = createComputed(() => output()?.available === true)
  const volume = createComputed(() => output()?.volume ?? { level: 0, muted: false })
  const muted = createComputed(() => volume().muted)
  const percent = createComputed(() => asPercent(volume().level))
  const muteIcon = createComputed(() => icon("volume", `system-${levelVariant(muted(), volume().level)}`))

  return (
    <box class="audio-hero" orientation={VERTICAL}>
      <box class="audio-hero-top">
        <box class="audio-caption-row" spacing={8}>
          <label class="audio-caption" label="Output" />
          <label class="audio-muted-pill" label="Muted" visible={muted} />
        </box>
        <box class="audio-hero-actions" spacing={2}>
          <SettingsGearButton />
          <IconButton
            name={createComputed(() => `${muted() ? "Unmute" : "Mute"} ${name()}`)}
            tooltip={createComputed(() => (muted() ? "Unmute output" : "Mute output"))}
            imagePath={muteIcon}
            active={muted}
            disabled={createComputed(() => !available())}
            onClicked={() => { const id = output()?.id; if (id) binding.actions.toggleOutputMute(id) }}
          />
        </box>
      </box>

      <DeviceSelector
        title="Output device"
        value={name}
        selectedId={createComputed(() => output()?.id ?? null)}
        disabled={createComputed(() => !model().outputs.some((item) => item.available))}
        devices={createComputed(() => model().outputs)}
        iconName="volume"
        onSelect={(id) => binding.actions.selectPreferredOutput(id)}
      />

      <box class="audio-level-row" spacing={14}>
        <box class="audio-big-value">
          <label class="audio-big-number" label={createComputed(() => `${percent()}`)} />
          <label class="audio-big-unit" label="%" />
        </box>
        <LevelControl
          label={createComputed(() => `${name()} output level`)}
          volume={volume}
          disabled={createComputed(() => !available())}
          className="audio-hero-level"
          sliderClass="settings-level-slider audio-hero-slider"
          showValue={false}
          onChange={(value) => { const id = output()?.id; if (id) binding.actions.setOutputVolume(id, value) }}
        />
      </box>
      <label class="audio-hero-note" xalign={0} label="Muted — the level is kept." visible={muted} />
    </box>
  )
}

// ---------------------------------------------------------------------------
// Deck — one surface, one mode visible.
// ---------------------------------------------------------------------------

function DeckTabs({ model }: { model: Accessor<AudioPanelViewModel> }) {
  return (
    <box class="audio-deck-head">
      <box class="audio-mode-tabs" spacing={20}>
        <button
          class={createComputed(() => `audio-mode-tab${deckMode() === "playing" ? " selected" : ""}`)}
          canFocus
          onClicked={() => chooseDeckMode("playing")}
          $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, "Playing"))}
        >
          <box spacing={5}>
            <label class="audio-mode-label" label="Playing" />
            <box
              class="audio-mode-dot"
              valign={Gtk.Align.CENTER}
              visible={createComputed(() => deckMode() === "mixer" && model().anyPlaying)}
            />
          </box>
        </button>
        <button
          class={createComputed(() => `audio-mode-tab${deckMode() === "mixer" ? " selected" : ""}`)}
          canFocus
          onClicked={() => chooseDeckMode("mixer")}
          $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, "Mixer"))}
        >
          <label class="audio-mode-label" label="Mixer" />
        </button>
      </box>
    </box>
  )
}

function PlayingEmpty() {
  return (
    <box class="audio-playing-empty" spacing={10}>
      <box class="audio-empty-art" />
      <box orientation={VERTICAL} valign={Gtk.Align.CENTER}>
        <label class="audio-empty-title" xalign={0} label="No playing apps" />
        <label class="audio-empty-sub" xalign={0} label="Use Mixer for apps that are only sending audio." />
      </box>
    </box>
  )
}

function PlayingLevel({ row }: { row: Accessor<AudioAppRowView> }) {
  const volume = createComputed(() => row().volume)
  const glyph = createComputed(() => icon("volume", `system-${levelVariant(volume().muted, volume().level)}`))
  return (
    <button
      class="audio-playing-level"
      tooltipText="Open in Mixer"
      onClicked={() => openMixerFor(row().id)}
      $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, `Open ${row().appName} in Mixer`))}
    >
      <box spacing={5}>
        <image pixel_size={15} $={(self: Gtk.Image) => setImageOnce(self, glyph())} />
        <label class="audio-playing-level-value" label={createComputed(() => volume().muted ? "Muted" : `${asPercent(volume().level)}%`)} />
        <label class="audio-playing-level-mixed" label="Mixed" visible={createComputed(() => row().mixedLevel)} />
      </box>
    </button>
  )
}

function PlayingPage({ row, index, total, binding }: {
  row: Accessor<AudioAppRowView>
  index: Accessor<number>
  total: Accessor<number>
  binding: AudioPanelBinding
}) {
  const title = createComputed(() => row().title || row().appName)
  const artist = createComputed(() => [row().artist, row().album].filter(Boolean).join(" · "))
  const canSeek = createComputed(() => row().canSeek)
  return (
    <box class="audio-playing-page" orientation={VERTICAL} spacing={6}>
      <box class="audio-playing-head" spacing={8}>
        <AppTile row={row} size={28} />
        <box class="audio-playing-meta" spacing={6} hexpand>
          <label class="audio-app-name" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={createComputed(() => row().appName)} />
          <label class="audio-live-badge" label="Live" visible={createComputed(() => !canSeek())} />
          <label class="audio-page-index" hexpand xalign={1} label={createComputed(() => `${index() + 1}/${total()}`)} />
        </box>
      </box>

      <box class="audio-player-strip" spacing={8}>
        <AppTile row={row} size={40} className="audio-artwork" />
        <box class="audio-track" orientation={VERTICAL} spacing={1} hexpand>
          <label class="audio-track-title" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={title} tooltipText={title} />
          <label class="audio-track-artist" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={createComputed(() => artist() || "Media details unavailable")} />
        </box>
        <TransportRow row={row} binding={binding} />
      </box>

      <SeekLine
        visible={canSeek}
        positionUs={createComputed(() => row().positionUs)}
        durationUs={createComputed(() => row().durationUs)}
        title={title}
        onCommit={(positionUs) => { const id = row().playerId; if (id) binding.actions.seek(id, positionUs) }}
      />

      <PlayingLevel row={row} />
    </box>
  )
}

function PlayingDeck({ binding }: { binding: AudioPanelBinding }) {
  const model = createComputed(() => binding.model())
  const pages = createComputed(() => model().playingRows)
  const active = createComputed<AudioAppRowView | null>(() =>
    pages().find((row) => row.id === playingId()) ?? pages()[0] ?? null)
  const index = createComputed(() => Math.max(0, pages().findIndex((row) => row.id === active()?.id)))
  const multi = createComputed(() => pages().length > 1)
  let lastWheel = 0

  return (
    <box class="audio-playing" orientation={VERTICAL} spacing={2} visible={createComputed(() => deckMode() === "playing")}>
      <box
        class="audio-playing-carousel"
        spacing={2}
        $={(self: Gtk.Widget) => {
          const scroll = new Gtk.EventControllerScroll()
          scroll.set_flags(Gtk.EventControllerScrollFlags.VERTICAL)
          scroll.connect("scroll", (_controller, _dx, dy) => {
            const now = Date.now()
            if (now - lastWheel < WHEEL_COOLDOWN_MS) return true
            lastWheel = now
            cyclePlaying(binding.model(), dy > 0 ? 1 : -1)
            return true
          })
          self.add_controller(scroll)
        }}
      >
        <button
          class="audio-carousel-button"
          tooltipText="Previous playing app"
          visible={multi}
          onClicked={() => cyclePlaying(binding.model(), -1)}
          $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, "Previous playing app"))}
        >
          <label class="audio-carousel-glyph" label="‹" />
        </button>

        <box class="audio-playing-viewport" hexpand>
          <With value={active}>
            {(page: AudioAppRowView | null) => page === null
              ? <PlayingEmpty />
              : (
                <PlayingPage
                  row={createComputed(() => {
                    const id = page.id
                    return binding.model().playingRows.find((row) => row.id === id) ?? page
                  })}
                  index={index}
                  total={createComputed(() => pages().length)}
                  binding={binding}
                />
              )}
          </With>
        </box>

        <button
          class="audio-carousel-button"
          tooltipText="Next playing app"
          visible={multi}
          onClicked={() => cyclePlaying(binding.model(), 1)}
          $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, "Next playing app"))}
        >
          <label class="audio-carousel-glyph" label="›" />
        </button>
      </box>
    </box>
  )
}

function MixerRow({ row, binding }: { row: Accessor<AudioAppRowView>; binding: AudioPanelBinding }) {
  const volume = createComputed(() => ({
    level: row().volume.level,
    muted: row().volume.muted,
    mixedLevel: row().mixedLevel,
    mixedMuted: row().mixedMuted,
  }))
  const appPresent = createComputed(() => row().hasCurrentStream || row().hasCurrentPlayer)
  const playerId = createComputed(() => row().hasCurrentPlayer && row().playerId ? row().playerId : null)
  const playing = createComputed(() => row().playback === "playing")
  const sub = createComputed(() => {
    const item = row()
    if (!item.hasCurrentPlayer) return "Audio only"
    return [item.title, item.artist].filter(Boolean).join(" · ") || item.appName
  })
  const muteIcon = createComputed(() => icon("volume", `system-${levelVariant(volume().muted, volume().level)}`))
  const focused = createComputed(() => mixerFocusId() === row().id)
  const routeShort = createComputed(() => {
    const intent = row().routeIntent
    if (intent?.kind === "follow-preferred") return "Follow preferred"
    if (intent?.kind === "explicit") {
      return binding.model().outputs.find((output) => output.id === intent.endpointId)?.name ?? "No route"
    }
    return row().routeLabel
  })

  function routeOptions(anchor: Gtk.Widget) {
    const current = row()
    const preferred = binding.model().outputs.find((output) => output.id === binding.model().preferredOutputId)?.name ?? "Unavailable"
    openChoicePopover(anchor, `${current.appName} output route`, [
      {
        label: `Follow preferred · ${preferred}`,
        selected: current.routeIntent?.kind === "follow-preferred",
        activate: () => binding.actions.setAppRoute(current.appId, { kind: "follow-preferred" }),
      },
      ...binding.model().outputs.map((output) => ({
        label: output.available ? `${output.name} · Override` : output.name,
        note: output.available ? "" : "Unavailable",
        selected: current.routeIntent?.kind === "explicit" && current.routeIntent.endpointId === output.id,
        disabled: !output.available,
        activate: () => binding.actions.setAppRoute(current.appId, { kind: "explicit", endpointId: output.id }),
      })),
    ])
  }

  return (
    <box class={createComputed(() => `audio-mixer-row${focused() ? " focused" : ""}`)} orientation={VERTICAL} spacing={2}
      $={(self: Gtk.Widget) => createEffect(() => accessibleLabel(self, `${row().appName}${row().title ? `, ${row().title}` : ""}`))}>
      <box class="audio-mixer-head" spacing={6}>
        <AppTile row={row} size={28} />
        <box class="audio-mixer-meta" orientation={VERTICAL} spacing={0} hexpand>
          <box class="audio-mixer-name-line" spacing={5}>
            <label class="audio-app-name" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={createComputed(() => row().appName)} />
            <box class="audio-playing-dot" valign={Gtk.Align.CENTER} visible={playing} />
          </box>
          <label class="audio-mixer-sub" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={sub} tooltipText={sub} />
        </box>
        <button
          class="audio-route"
          tooltipText={createComputed(() => row().routeLabel)}
          onClicked={(self: Gtk.Button) => routeOptions(self)}
          $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, `${row().appName} route: ${row().routeLabel}`))}
        >
          <label class="audio-route-label" ellipsize={Pango.EllipsizeMode.END} label={routeShort} />
        </button>
        <IconButton
          name={createComputed(() => `${playing() ? "Pause" : "Play"} ${row().appName}`)}
          tooltip={createComputed(() => (playing() ? "Pause" : "Play"))}
          imagePath={createComputed(() => icon("media-transport-panel", playing() ? "pause" : "play"))}
          visible={createComputed(() => playerId() !== null && row().capabilities.canPlayPause)}
          onClicked={() => { const id = playerId(); if (id) binding.actions.playerAction(id, "play-pause") }}
          active={playing}
          pixelSize={26}
          className="audio-icon-button audio-mixer-play"
        />
      </box>

      <box class="audio-mixer-controls" spacing={6}>
        <IconButton
          name={createComputed(() => `${row().appName} volume ${volume().muted ? "muted" : volume().mixedMuted ? "mixed mute" : "unmuted"}`)}
          tooltip={createComputed(() => (volume().muted ? "Unmute" : "Mute"))}
          imagePath={muteIcon}
          onClicked={() => binding.actions.toggleAppMute(row().appId)}
          active={createComputed(() => volume().muted || volume().mixedMuted === true)}
          disabled={createComputed(() => !appPresent())}
          className="audio-icon-button audio-mixer-mute"
        />
        <LevelControl
          label={createComputed(() => `${row().appName} volume`)}
          volume={volume}
          disabled={createComputed(() => !appPresent())}
          className="audio-mixer-level"
          sliderClass="settings-level-slider audio-level-slider"
          showValue={false}
          onChange={(value) => binding.actions.setAppVolume(row().appId, value)}
        />
        <box class="audio-mixer-value" orientation={VERTICAL} spacing={1}>
          <label class="audio-mixer-pct" xalign={1} label={createComputed(() => `${asPercent(volume().level)}%`)} />
          <label class="audio-mixer-mixed" xalign={1} label="Mixed" visible={createComputed(() => row().mixedLevel)} />
        </box>
      </box>
    </box>
  )
}

function MixerEmpty({ visible }: { visible: Accessor<boolean> }) {
  return (
    <box class="audio-mixer-empty" spacing={10} visible={visible}>
      <box class="audio-empty-art" />
      <box orientation={VERTICAL} valign={Gtk.Align.CENTER}>
        <label class="audio-empty-title" xalign={0} label="No apps playing" />
        <label class="audio-empty-sub" xalign={0} label="Apps with audio show up here with their own volume and route." />
      </box>
    </box>
  )
}

function MixerDeck({ binding }: { binding: AudioPanelBinding }) {
  const rows = createComputed(() => binding.model().rows)
  return (
    <box class="audio-mixer" orientation={VERTICAL} visible={createComputed(() => deckMode() === "mixer")}>
      <For each={rows} id={(row) => row.id}>
        {(item) => {
          const id = item.id
          const row = createComputed(() => binding.model().rows.find((candidate) => candidate.id === id) ?? item)
          return <MixerRow row={row} binding={binding} />
        }}
      </For>
      <MixerEmpty visible={createComputed(() => rows().length === 0)} />
    </box>
  )
}

// ---------------------------------------------------------------------------
// Input — secondary and collapsed by default.
// ---------------------------------------------------------------------------

function InputSection({ binding }: { binding: AudioPanelBinding }) {
  const model = createComputed(() => binding.model())
  const input = createComputed<EndpointState | null>(() => {
    const state = model()
    return state.inputs.find((device) => device.id === state.preferredInputId) ?? null
  })
  const name = createComputed(() => input()?.name ?? "No input available")
  const available = createComputed(() => input()?.available === true)
  const volume = createComputed(() => input()?.volume ?? { level: 0, muted: false })
  const volumeWithMute = createComputed(() => ({ level: volume().level, muted: volume().muted }))
  const consumers = createComputed(() => model().inputConsumers)
  const summary = createComputed(() => {
    if (!available()) return "No input available"
    return volume().muted ? `${name()} · Muted` : name()
  })

  return (
    <box class="audio-section audio-input-section" orientation={VERTICAL}>
      <button
        class="audio-section-head"
        canFocus
        onClicked={toggleInputOpen}
        $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, `Input, ${summary()}`))}
      >
        <box class="audio-section-head-row" spacing={8}>
          <label class="audio-section-title" label="Input" />
          <box class="audio-live-dot" valign={Gtk.Align.CENTER} visible={createComputed(() => available() && consumers().length > 0)} />
          <label class="audio-section-summary" xalign={0} hexpand ellipsize={Pango.EllipsizeMode.END} label={summary} />
          <label class="audio-section-chevron" label={createComputed(() => (inputOpen() ? "▴" : "▾"))} />
        </box>
      </button>

      <box class="audio-input-body" orientation={VERTICAL} spacing={6} visible={inputOpen}>
        <DeviceSelector
          title="Input device"
          value={name}
          selectedId={createComputed(() => input()?.id ?? null)}
          disabled={createComputed(() => !model().inputs.some((device) => device.available))}
          devices={createComputed(() => model().inputs)}
          iconName="microphone"
          fallbackVariant="system-mic-on"
          summary
          onSelect={(id) => binding.actions.selectInput(id)}
        />
        <box class="audio-input-controls" spacing={6}>
          <IconButton
            name={createComputed(() => `${name()} microphone ${volume().muted ? "muted" : "unmuted"}`)}
            tooltip={createComputed(() => (volume().muted ? "Unmute" : "Mute"))}
            imagePath={createComputed(() => icon("microphone", volume().muted ? "system-mic-off" : "system-mic-on"))}
            onClicked={() => binding.actions.toggleInputMute()}
            active={createComputed(() => volume().muted)}
            disabled={createComputed(() => !available())}
            className="audio-icon-button audio-input-mute"
          />
          <LevelControl
            label={createComputed(() => `${name()} input level`)}
            volume={volumeWithMute}
            disabled={createComputed(() => !available())}
            className="audio-input-level"
            sliderClass="settings-level-slider audio-level-slider secondary"
            showValue={false}
            onChange={(value) => { const id = input()?.id; if (id) binding.actions.setInputVolume(id, value) }}
          />
          <label class="audio-input-value" xalign={1} label={createComputed(() => (available() ? `${asPercent(volume().level)}%` : "—"))} />
        </box>

        <For each={consumers} id={(consumer) => consumer.id}>
          {(consumer: AudioInputConsumerView) => (
            <box class="audio-consumer" spacing={8}>
              <image class="audio-consumer-icon" pixel_size={18}
                $={(self: Gtk.Image) => setImageOnce(self, icon("app-icons", consumer.iconName || "application-x-executable"))} />
              <label class="audio-consumer-name" xalign={0} hexpand label={consumer.appName} />
              <box class="audio-live-dot" valign={Gtk.Align.CENTER} />
              <label class="audio-consumer-use" label="Using microphone" />
            </box>
          )}
        </For>
        <label
          class="audio-empty-line"
          xalign={0}
          label={createComputed(() => available() ? "No microphone use right now." : "No microphone detected.")}
          visible={createComputed(() => consumers().length === 0)}
        />
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Settings (the Output gear) — the only config surface.
// ---------------------------------------------------------------------------

export function SettingsContent() {
  return (
    <box class="audio-settings" orientation={VERTICAL} spacing={0}>
      <label class="audio-settings-head" xalign={0} label="Settings" />
      <box class="audio-settings-row" spacing={16}>
        <box class="audio-settings-text" orientation={VERTICAL} spacing={3} hexpand>
          <label class="audio-settings-name" xalign={0} label="Bar media widget" />
          <label class="audio-settings-help" xalign={0} label="Show the now-playing strip in the top bar." />
        </box>
        <switch
          class="audio-switch"
          valign={Gtk.Align.CENTER}
          active={mediaWidgetEnabled}
          onNotifyActive={(self: Gtk.Switch) => {
            const next = self.get_active()
            if (next === mediaWidgetEnabled()) return
            setMediaWidgetEnabled(next)
          }}
        />
      </box>
      <label class="audio-settings-foot" xalign={0} label="Changes save immediately." />
    </box>
  )
}

function openSettingsPopover(anchor: Gtk.Widget): void {
  const popover = new Gtk.Popover({ autohide: true })
  popover.set_has_arrow(false)
  popover.add_css_class("audio-settings-popover")
  popover.set_parent(anchor)

  const content = (<SettingsContent />) as unknown as Gtk.Widget

  popover.set_child(content)
  setSettingsOpenState(true)
  popover.connect("closed", () => {
    setSettingsOpenState(false)
    popover.unparent()
    anchor.grab_focus()
  })
  popover.popup()
}

function SettingsGearButton() {
  return (
    <button
      class={createComputed(() => `audio-icon-button audio-settings-gear${settingsOpen() ? " active" : ""}`)}
      tooltipText="Settings"
      canFocus
      onClicked={(self: Gtk.Button) => openSettingsPopover(self)}
      $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, "Sound settings"))}
    >
      <image pixel_size={18} $={(self: Gtk.Image) => setImageOnce(self, icon("settings", "default"))} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Panel composition.
// ---------------------------------------------------------------------------

function AudioFoot() {
  return (
    <box class="audio-foot">
      <label class="audio-foot-note" xalign={0} hexpand label="Changes apply immediately." />
      <label class="audio-foot-hint" label="Esc closes" />
    </box>
  )
}

/** Compact presentation surface. Actions and the read model are supplied by the composition root. */
export function AudioPanelContent({
  binding,
  maxScrollHeight = 360,
}: {
  binding: AudioPanelBinding
  /** The deck scroller is fixed-height (the old drawer's measured lesson), clamped to the monitor. */
  maxScrollHeight?: number
}) {
  const model = createComputed(() => binding.model())
  createEffect(() => reconcilePlaying(model()))
  const scrollHeight = createComputed(() =>
    Math.min(maxScrollHeight, deckMode() === "mixer" ? 440 : 280))
  return (
    <box class="audio-panel" orientation={VERTICAL} spacing={0}>
      <OutputHero binding={binding} />
      <scrolledwindow
        class="audio-scroll"
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        heightRequest={scrollHeight}
      >
        <box class="audio-scroll-body" orientation={VERTICAL}>
          <box class="audio-deck" orientation={VERTICAL}>
            <DeckTabs model={model} />
            <PlayingDeck binding={binding} />
            <MixerDeck binding={binding} />
          </box>
          <InputSection binding={binding} />
        </box>
      </scrolledwindow>
      <AudioFoot />
    </box>
  )
}

/** Full-screen click-outside catcher, shared through the kit's `PopupCatcher`. */
export function AudioCatcher(gdkmonitor: Gdk.Monitor) {
  return (
    <PopupCatcher
      name="audio-catcher"
      gdkmonitor={gdkmonitor}
      visible={popupVisible}
      onClose={close}
    />
  )
}

/**
 * Popup shell. The binding is REQUIRED: it carries the session view model and
 * the application actions, and this view owns no audio policy of its own.
 *
 * The window, catcher, anchor margin and keymode are the kit's `PopupHost`
 * (spine AD-10); this function owns only the audio surface's width and body.
 */
export function AudioPopup(gdkmonitor: Gdk.Monitor, binding: AudioPanelBinding) {
  // The deck scroller is fixed-height so a long Mixer cannot collapse the
  // popover to its minimum (the same measured failure the old drawer hit with
  // min/max content height). Clamp to the monitor so a short screen still
  // yields a usable panel.
  const maxScrollHeight = Math.max(220, gdkmonitor.get_geometry().height - 48 - 52 - 24 - 180)

  // The deck default is resolved when the panel opens (the session may already
  // be hydrated), and again only while the user has made no explicit choice.
  createEffect(() => {
    if (!popupVisible()) {
      // The settings popover is parented to a widget in this window; a hidden
      // panel destroys it without emitting `closed`, so clear the gear state.
      setSettingsOpenState(false)
      return
    }
    resolveDeckMode(binding.model().playingRows.length > 0)
  })

  const spec: PopupSurfaceSpec = {
    id: "audio",
    width: 352,
    body: () => <AudioPanelContent binding={binding} maxScrollHeight={maxScrollHeight} />,
  }
  return (
    <PopupHost
      spec={spec}
      name="audio-popup"
      windowClass="audio-popup"
      surfaceClass="audio-surface"
      gdkmonitor={gdkmonitor}
      visible={popupVisible}
      anchorX={audioIconX}
      onClose={close}
    />
  )
}

