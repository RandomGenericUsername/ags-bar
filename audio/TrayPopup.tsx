import { Gtk, Gdk } from "ags/gtk4"
import Pango from "gi://Pango?version=1.0"
import { Accessor, For, With, createComputed, createEffect } from "ags"
import type { AudioPanelBinding } from "./binding"
import type { AudioAppRowView, AudioPanelViewModel } from "./presentation/audio-panel-view-model"
import { AppTile, SeekLine, TransportRow, accessibleLabel, icon, setImageOnce } from "./ui/controls"
import {
  closeTray,
  playingId,
  selectPlaying,
  setTrayPlayerCount,
  trayAnchorX,
  trayOpen,
  trayPopupVisible,
} from "./panel-state"
import { mediaWidgetEnabled } from "../settings/state"
import { overlays } from "../kit/overlay"
import { PopupCatcher, PopupHost, type PopupSurfaceSpec } from "../kit/popup-host"

/**
 * The tray dropdown (REQ-005).
 *
 * Menu-like, 300 px, anchored below the now-playing strip. Shows the active
 * track with transport and seek, a `Players` list only when more than one
 * current player exists, and an `Open sound panel` footer. It is a layer-shell
 * overlay like the panel (surface.panel, never surface.window) and shares the
 * panel's selected player, so switching a row here moves the strip and the
 * Playing page together.
 */

function activePlayer(model: AudioPanelViewModel): AudioAppRowView | null {
  const pages = model.playingRows
  return pages.find((row) => row.id === playingId()) ?? pages[0] ?? null
}

function PlayerRow({ row, active }: { row: Accessor<AudioAppRowView>; active: Accessor<boolean> }) {
  const name = createComputed(() => row().appName)
  const title = createComputed(() => row().title || row().appName)
  return (
    <button
      class={createComputed(() => `audio-tray-player${active() ? " active" : ""}`)}
      canFocus
      onClicked={() => selectPlaying(row().id)}
      $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self,
        `${name()}${row().playerIdentity ? ` · ${row().playerIdentity}` : ""}${active() ? ", selected" : ""}`))}
    >
      <box class="audio-tray-player-row" spacing={7}>
        <AppTile row={row} size={22} />
        <box class="audio-tray-player-meta" orientation={Gtk.Orientation.VERTICAL} spacing={0} hexpand>
          <box class="audio-tray-player-name-line" spacing={4}>
            <label class="audio-tray-player-name" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={name} />
            <box class="audio-playing-dot" valign={Gtk.Align.CENTER} visible={createComputed(() => row().playback === "playing")} />
          </box>
          <label class="audio-tray-player-track" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={title} />
          <label class="audio-tray-player-identity" xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={20}
            label={createComputed(() => row().playerIdentity ?? "")}
            visible={createComputed(() => Boolean(row().playerIdentity))}
            tooltipText={createComputed(() => row().playerIdentity ?? "")} />
        </box>
        <label class="audio-tray-check" label={createComputed(() => (active() ? "✓" : ""))} />
      </box>
    </button>
  )
}

export function TrayBody({ binding }: { binding: AudioPanelBinding }) {
  const model = createComputed(() => binding.model())
  const active = createComputed(() => activePlayer(model()))
  const title = createComputed(() => active()?.title || active()?.appName || "")
  const artist = createComputed(() => active()?.artist || "")
  const multi = createComputed(() => model().playingRows.length > 1)
  const canSeek = createComputed(() => active()?.canSeek === true)

  return (
    <With value={active}>
      {(row: AudioAppRowView | null) => row === null
        ? <box class="audio-tray-empty" />
        : (
          <box class="audio-tray" orientation={Gtk.Orientation.VERTICAL} spacing={0}>
            <box class="audio-tray-head" spacing={6}>
              <label class="audio-tray-caption" label="Now playing" />
              <box class="audio-tray-source" spacing={5} hexpand>
                <AppTile row={createComputed(() => row)} size={14} />
                <label class="audio-tray-source-name" xalign={1} hexpand ellipsize={Pango.EllipsizeMode.END} label={row.appName} />
              </box>
            </box>

            <box class="audio-tray-track-row" spacing={9}>
              <AppTile row={createComputed(() => row)} size={36} className="audio-artwork" />
              <box class="audio-tray-meta" orientation={Gtk.Orientation.VERTICAL} spacing={1} hexpand>
                <label class="audio-tray-title" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={title} tooltipText={title} />
                <label class="audio-tray-artist" xalign={0} ellipsize={Pango.EllipsizeMode.END} label={artist} />
              </box>
            </box>

            <box halign={Gtk.Align.CENTER}>
              <TransportRow row={createComputed(() => row)} binding={binding} className="audio-tray-transport" playSize={36} iconSize={18} />
            </box>

            <SeekLine
              compact
              visible={canSeek}
              positionUs={createComputed(() => active()?.positionUs ?? null)}
              durationUs={createComputed(() => active()?.durationUs ?? null)}
              playing={createComputed(() => active()?.playback === "playing")}
              title={title}
              onCommit={(positionUs) => {
                const id = active()?.playerId
                if (id) binding.actions.seek(id, positionUs)
              }}
            />

            <box class="audio-tray-players" orientation={Gtk.Orientation.VERTICAL} spacing={0} visible={multi}>
              <box class="audio-tray-divider" />
              <label class="audio-tray-players-head" xalign={0} label="Players" />
              <For each={createComputed(() => model().playingRows)} id={(player: AudioAppRowView) => player.id}>
                {(player: AudioAppRowView) => {
                  const id = player.id
                  return (
                    <PlayerRow
                      row={createComputed(() => model().playingRows.find((item) => item.id === id) ?? player)}
                      active={createComputed(() => active()?.id === id)}
                    />
                  )
                }}
              </For>
            </box>

            <box class="audio-tray-foot">
              <button
                class="audio-tray-open"
                canFocus
                onClicked={() => {
                  const anchor = trayAnchorX()
                  closeTray()
                  overlays.open("audio", anchor)
                }}
                $={(self: Gtk.Button) => createEffect(() => accessibleLabel(self, "Open sound panel"))}
              >
                <box spacing={7}>
                  <image pixel_size={16} $={(self: Gtk.Image) => setImageOnce(self, icon("volume", "system-medium"))} />
                  <label class="audio-tray-open-label" label="Open sound panel" />
                </box>
              </button>
            </box>
          </box>
        )}
    </With>
  )
}

export function TrayPopupCatcher(gdkmonitor: Gdk.Monitor) {
  return (
    <PopupCatcher
      name="tray-popup-catcher"
      gdkmonitor={gdkmonitor}
      visible={trayPopupVisible}
      onClose={closeTray}
    />
  )
}

export function TrayPopup(gdkmonitor: Gdk.Monitor, binding: AudioPanelBinding) {
  // Publish the current-player count so the overlay coordinator's `isOpen`
  // (which cannot import the composition root) and the dropdown agree.
  createEffect(() => setTrayPlayerCount(binding.model().playingRows.length))

  // No player or the setting off hides the dropdown rather than leaving an
  // empty shell open; the strip already closes/reopens from the same state.
  createEffect(() => {
    if (!trayOpen()) return
    if (!mediaWidgetEnabled() || activePlayer(binding.model()) === null) closeTray()
  })

  const spec: PopupSurfaceSpec = {
    id: "tray",
    width: 300,
    body: () => <TrayBody binding={binding} />,
  }
  return (
    <PopupHost
      spec={spec}
      name="tray-popup"
      windowClass="tray-popup"
      surfaceClass="tray-surface"
      gdkmonitor={gdkmonitor}
      visible={trayPopupVisible}
      anchorX={trayAnchorX}
      onClose={closeTray}
    />
  )
}
