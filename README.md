# ags-bar

Standalone AGS bar. The repo root **is** the app package; the inner `bar/`
directory is the widget/registry package. Extracted from `ags-apps` `v0.5.0`
as the last app of the standalone-app program.

| Field | Value |
| --- | --- |
| Repo | `ags-bar` |
| App id | `bar` |
| AGS instance | `ags` |
| Config dir | `ags` |
| Window | `bar` |
| Manifest mode | `restart` (`holdsUnsavedState: false`) |
| Source snapshot | `ags-apps` tag `v0.5.0`, directory `bar/` |

`app.manifest.json` is the single identity source. The runtime discovers the
deployed config link, requires `manifest.instance == app.tsx instanceName ==
ags list`, and requires `manifest.configDir == the deployed link basename`.
For this app the deployed link is the historical `config/ags` -> the bar
checkout, and the AGS instance is the default `ags`.

## Runtime contract

### Restart, not live refresh

The bar is the explicit **restart** app (AD-26/AD-30). It has no
`palette-refresh` handler and must not grow one by accident. After an
appearance change the runtime's serialized restart lane restarts the bar; a
failed live refresh never becomes a restart because there is no live refresh
here. `theme.apply()` runs once at startup and applies the stable
`$XDG_CONFIG_HOME/ags/colors.css` pointer.

### Request surface

`app.tsx` keeps the bar's complete `requestHandler` surface:

```sh
ags request popup-close       -i ags   # close every bar overlay (Esc keybind)
ags request settings-close    -i ags   # legacy settings dismissal
ags request audio-panel-open  -i ags   # open the audio popup (debug entry)
ags request audio-panel-debug -i ags   # dump the audio projection to state
```

Every overlay registered in `overlays.ts` is closed by `popup-close` through
`overlays.closeAll()`/the existing close list. Unknown requests answer
`unknown request: <argv>` exactly as before.

### Install-time concerns (not repo state)

AD-37: installed tags are immutable; writable state lives under XDG.

- **`colors.css`** — committed as a symlink to the stable runtime-owned pointer
  `$XDG_STATE_HOME/dotfiles/current/colors.gtk.css`, surfaced at
  `$XDG_CONFIG_HOME/ags/colors.css`. The engine's `barPalettePointer` contract
  verifies the link target at install time; the app never writes it.
- **`icons.json`** — the bar's icon artifact. It is produced from the pinned
  `dotfiles-assets` tuple; provisioning verifies **byte equality** and never
  authors a second copy. Treat it as generated, not hand-authored.
- **`audio/audio-panel.css`** — deployed into the config dir and applied from
  `$XDG_CONFIG_HOME/ags/audio/audio-panel.css` at runtime.
- **`wifi-speedtest.json`** — a legacy **seed default** tracked at the repo root
  for provisioning. It is **not** user state and never a read/write target; the
  service state lives under `$XDG_STATE_HOME/ags/`. See the cutover section.

## Cutover state migration (wifi-speedtest)

AD-37: installed tags are immutable; writable state lives under XDG.

Before this change the speed-test service read/wrote
`$XDG_CONFIG_HOME/ags/wifi-speedtest.json` and `wifi-speedtest-last.json`.
Because the deployed `config/ags` link points at the installed tag, those paths
resolved **inside the tag**, so every tag bump reset the user's interval,
server mode and last measurement.

The service now owns these paths:

| Purpose | Path | Writer |
| --- | --- | --- |
| Settings | `$XDG_STATE_HOME/ags/wifi-speedtest.json` | bar service |
| Last measurement | `$XDG_STATE_HOME/ags/wifi-speedtest-last.json` | bar service |
| Legacy source | `$XDG_CONFIG_HOME/ags/wifi-speedtest*.json` | read once by migration |

Migration behavior (`services/speedtest-state.ts`,
`migrateLegacySpeedTestState`), run before the first read on every start. It is
a one-time migration per file because the target's existence is the gate:

1. If the XDG state target already exists, the legacy file is ignored. This is
   what makes the migration one-time and ensures a later user edit wins.
2. If the target is absent and the legacy file exists, the bytes are copied and
   the state directory is created on demand. The legacy file is **never**
   deleted or modified — the old tag may be read-only and a rollback to it must
   work.
3. A legacy file that is not a JSON object is not copied; the target stays
   absent so the migration retries after the source is fixed.
4. Failures are logged and never block startup; defaults remain usable.

The tracked `wifi-speedtest.json` at the repo root is an explicit provisioning
**seed default**, not user state. It is never the read/write target after
cutover; deleting it cannot lose a user setting.

`tests/ts/speedtest-state.test.ts` is the tag-bump/persistence proof: it seeds
the old config dir, migrates, deletes that directory (a tag bump or rollback),
creates a fresh empty one, and asserts the interval, server mode and last
measurement survive.

The committed `colors.css` symlink is verified to point at the stable runtime
pointer outside the tag — the app only applies it through `theme.apply()` and
never writes it. `icons.json` keeps its single `dotfiles-assets` producer, with
provisioning verifying byte equality. Both are install-time checks, not app
code.

Full acceptance lives in `tickets/OPS-001-cutover-state-migration/ticket.md`.

## Local development

The program tuple is `ags-platform` / `contracts` / `dotfiles-assets` `v0.3.0`.
Those tags are local-only in this run; the local gates use a gitignored symlink
under `.dev/`.

```sh
ln -s ../../../ags-platform .dev/ags-platform/v0.3.0   # or use AGS_PLATFORM_DEV
ln -s ../../../contracts .dev/contracts/v0.3.0         # or use CONTRACTS_ROOT
make test          # pure unit + validation suites + symbol check (Node only)
make conformance   # manifest + restart/no-handler + install-time docs + template gate
make drift         # generated contract + shared client <-> contracts drift gate
make typecheck     # LOCAL desktop stack: ags + GIR declarations
make bundle        # LOCAL: `ags bundle app.tsx build/ags-bar.js`
make gates         # all of the above
```

`make test`, `make conformance` and `make drift` are the stock-runner gates.
Typecheck is local and authoritative; CI deliberately has no self-hosted job
(AD-19/AD-23).

Run the app (desktop session; not part of this repo-creation task):

```sh
ags run -d .
ags request popup-close -i ags
```

## Repo layout

```text
app.tsx                  AGS entry point (instance ags, restart mode)
app.manifest.json        identity tuple
bar/                     bar manifest, registry, widgets, validators
audio/                   audio panel hexagon + validation suites
components/              wifi/bluetooth/battery popups and primitives
settings-panel/          settings overlay
services/                network, bluetooth, power, MPRIS, speedtest services
domains/ kit/ lib/       read models, reactive primitives, generated contract
icons.json               bar icon artifact (generated; install-time verified)
overlays.ts              overlay registration
style.css                bar + popup stylesheet (palette tokens from colors.css)
tests/                   pure unit, validation, symbol, conformance, drift
tickets/                 LIFECYCLE, INDEX, _template, this repo's tickets
scripts/worktree-guard.sh
.github/workflows/ci.yml stock-runner CI (make ci)
```

## Consumer surfaces / cutover

`ags-apps` REQ-015, `dotfiles-v3`, `dotfiles-provision` and
`dotfiles-runtime` own the host-side cutover: the app-list entry, the
`config/ags` link, the restart lane, autostart and the launch lock. This repo
does not provision or edit those repos; it proves only the app-side contract.
No GUI or host changes are part of this extraction.
