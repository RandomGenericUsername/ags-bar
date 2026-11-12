import { Gtk, Gdk } from "ags/gtk4"
import Pango from "gi://Pango?version=1.0"
import { With, createComputed } from "ags"
import { overlays } from "../../kit/overlay"
import type { RichWidgetSpec } from "../../kit/widget"
import type { AudioPanelBinding } from "../../audio/binding"
import type { AudioAppRowView, AudioPanelViewModel } from "../../audio/presentation/audio-panel-view-model"
import { AppTile, TransportRow } from "../../audio/ui/controls"
import {
  cyclePlaying,
  playingId,
  showTrayCue,
  clearTrayCue,
  trayCue as trayCueAccessor,
  trayOpen,
  closeTray,
} from "../../audio/panel-state"
import { mediaWidgetEnabled } from "../../settings/state"

/**
 * The bar's now-playing strip (REQ-005).
 *
 * An always-visible full strip — not an icon and not hover-only — in the end
 * cluster before the tray/microphone/network/volume/battery icons. It is the
 * media entry point: clicking its art/title/background opens the tray dropdown
 * and closes the sound panel; the transport buttons drive the active player and
 * never open anything. The mouse wheel cycles current players (one switch per
 * ~250 ms) and shows a brief `n/N · App` cue in the artist line.
 *
 * The strip follows the panel carousel's selected player (`playingId`), so the
 * strip, the dropdown and the Playing page cannot disagree. No player, or the
 * `Bar media widget` setting off, hides it (the dropdown closes with it).
 *
 * Rich shape, NO `primary`: a `primary` makes the shell wrap the strip in a
 * button, and nested transport buttons must stay real buttons. The click area
 * is the main box only, which is also exactly "art/title/background".
 */

const WHEEL_COOLDOWN_MS = 250
const CUE_MS = 1000

function playingRows(model: AudioPanelViewModel): readonly AudioAppRowView[] {
  return model.playingRows
}

function activeRow(model: AudioPanelViewModel): AudioAppRowView | null {
  const pages = playingRows(model)
  return pages.find((row) => row.id === playingId()) ?? pages[0] ?? null
}

function anchorCentre(widget: Gtk.Widget): number | null {
  try {
    const root = widget.get_root()
    if (root === null) return null
    const result = widget.compute_bounds(root) as unknown
    if (!Array.isArray(result) || result.length < 2 || !result[0]) return null
    const rect = result[1] as { get_x(): number; get_width(): number }
    return Math.round(rect.get_x() + rect.get_width() / 2)
  } catch {
    return null
  }
}

let cueTimer: ReturnType<typeof setTimeout> | null = null
function showCue(model: AudioPanelViewModel): void {
  const pages = playingRows(model)
  const active = activeRow(model)
  if (active === null) return
  const index = Math.max(0, pages.findIndex((row) => row.id === active.id))
  showTrayCue(`${index + 1}/${pages.length} · ${active.appName}`)
  if (cueTimer !== null) clearTimeout(cueTimer)
  cueTimer = setTimeout(() => {
    cueTimer = null
    clearTrayCue()
  }, CUE_MS)
}

function MediaStrip({ binding }: { binding: AudioPanelBinding }) {
  const model = createComputed(() => binding.model())
  const active = createComputed(() => activeRow(model()))
  const title = createComputed(() => active()?.title || active()?.appName || "")
  const artist = createComputed(() => active()?.artist || "")

  return (
    <box class="audio-strip-slot" widthRequest={340}>
      <box class="audio-strip" spacing={4} halign={Gtk.Align.CENTER}>
      <box
        class="audio-strip-main"
        hexpand
        $={(self: Gtk.Widget) => {
          const click = new Gtk.GestureClick({ button: Gdk.BUTTON_PRIMARY })
          click.connect("released", () => {
            const x = anchorCentre(self)
            if (trayOpen()) closeTray()
            else overlays.open("tray", x)
          })
          self.add_controller(click)
        }}
      >
        <With value={active}>
          {(row: AudioAppRowView | null) => row === null
            ? <box class="audio-strip-empty" />
            : (
              <box class="audio-strip-inner" spacing={8} hexpand valign={Gtk.Align.CENTER}>
                <AppTile row={createComputed(() => row)} size={32} className="audio-strip-art" />
                <box class="audio-strip-text" orientation={Gtk.Orientation.VERTICAL} spacing={0} hexpand>
                  <label class="audio-strip-title" xalign={0} hexpand maxWidthChars={24} ellipsize={Pango.EllipsizeMode.END} label={title} />
                  <label class="audio-strip-artist" xalign={0} hexpand maxWidthChars={26} ellipsize={Pango.EllipsizeMode.END}
                    label={createComputed(() => trayCueValue() ?? artist())} />
                </box>
              </box>
            )}
        </With>
      </box>
      <With value={active}>
        {(row: AudioAppRowView | null) => row === null
          ? <box />
          : (
            <TransportRow
              row={createComputed(() => row)}
              binding={binding}
              className="audio-strip-controls"
              compact
              playSize={30}
              iconSize={15}
            />
          )}
      </With>
      </box>
    </box>
  )
}

// The cue is a session UI value; reading it here keeps the strip label in sync
// without threading a timer through the spec.
function trayCueValue(): string | null {
  return trayCueAccessor()
}

export function createMediaStripWidget(binding: AudioPanelBinding): RichWidgetSpec<AudioPanelViewModel> {
  let lastWheel = 0
  return {
    id: "media-strip",
    read: () => binding.model(),
    class: "media-strip-widget",
    tooltip: () => "Now playing",
    visible: (model) => mediaWidgetEnabled() && playingRows(model).length > 0,
    scroll: (model, dy) => {
      const now = Date.now()
      if (now - lastWheel < WHEEL_COOLDOWN_MS) return
      lastWheel = now
      if (playingRows(model).length <= 1) return
      cyclePlaying(model, dy > 0 ? 1 : -1)
      showCue(model)
    },
    content: () => <MediaStrip binding={binding} />,
  }
}
