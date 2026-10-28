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

- **`colors.css`** — a stable runtime-owned pointer at
  `$XDG_CONFIG_HOME/ags/colors.css`, created/verified by the runtime seeder at
  install time. It is not committed here, and the app never writes it.
- **`icons.json`** — the bar's icon artifact. It is produced from the pinned
  `dotfiles-assets` tuple; provisioning verifies it and never authors a second
  copy. Treat it as generated, not hand-authored.
- **`audio/audio-panel.css`** — deployed into the config dir and applied from
  `$XDG_CONFIG_HOME/ags/audio/audio-panel.css` at runtime.
- **`wifi-speedtest.json`** — a legacy seed default tracked at the repo root.
  It is **not** user state. See the cutover section.

## Cutover state migration (wifi-speedtest)

This repo is created only; no host, provisioning or runtime change is made
here. Before the cutover flips `config/ags` to this app:

1. `bar/services/speedtest-service.ts` currently reads/writes
   `$XDG_CONFIG_HOME/ags/wifi-speedtest.json` and
   `$XDG_CONFIG_HOME/ags/wifi-speedtest-last.json`. Under the old deployment
   `config/ags` is the tag, so those writes land **inside the immutable tag**
   and a tag bump resets the user's interval/server mode and last measurement.
2. Move the service's writable paths to XDG state outside the install tree
   (for example `$XDG_STATE_HOME/ags/wifi-speedtest.json` and
   `wifi-speedtest-last.json`), with a one-time migration from the current
   `$XDG_CONFIG_HOME/ags/` files.
3. Keep the tracked `wifi-speedtest.json` here as a seed only, or retire it once
   the external default is owned by provisioning. A tag-bump test must prove the
   user's interval, server mode and last measurement survive.
4. Verify `colors.css` is the stable runtime pointer outside the tag and that
   `icons.json` has one producer. These are install-time checks, not app code.

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
