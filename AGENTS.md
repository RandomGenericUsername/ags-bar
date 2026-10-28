# AGENTS.md — ags-bar operating contract

Canonical agent instructions for this repo. Claude (`CLAUDE.md` symlinks here),
OpenCode and every BMAD/OpenSpec skill must follow this.

## 1. Evidence rule (hard requirement)

No suggestion "in the air". Every technical claim, recommendation or design
decision carries testable evidence: a file path + line range, a commit SHA, a
URL + quoted section, or an executed command with its result.

Format: non-trivial claims get `Evidence:` and `Verify:` lines. If evidence
does not exist yet, write `Evidence: MISSING — run <X>` and do not present the
claim as fact. Prefer executed output over recalled text.

## 2. What this repo is

`ags-bar` is the standalone AGS bar, extracted last from `ags-apps` v0.5.0.
The repo root is the app package: `app.tsx` lives at the root, never in a
subdirectory. The inner `bar/` directory is the widget/registry package, not an
app root.

Identity is single-valued and enforced by `app.manifest.json`:

```text
app=bar  instance=ags  configDir=ags
mode=restart  holdsUnsavedState=false
```

- Window: `bar`; AGS instance: `ags`; deployed config link basename: `ags`.
- The request surface is part of the app contract: `popup-close`,
  `settings-close`, `audio-panel-open`, `audio-panel-debug`, plus the
  unknown-request response. Do not drop or rename these while extracting.
- No app imports another app. Depend on `ags-platform` (and `contracts` at test
  time only), never on a sibling app repo.
- **No `palette-refresh` handler.** The bar is the explicit `restart` app. The
  runtime's serialized restart lane restarts it after an appearance change; the
  app does not subscribe to `wallpaper.state`, invent a palette event, or answer
  a live-refresh command. `theme.apply()` runs once at startup.

## 3. Install-time vs repo state

AD-37: installed tags are immutable and writable state lives under XDG.

- `colors.css` is committed as a **symlink** to the stable runtime-owned
  pointer (`$XDG_STATE_HOME/dotfiles/current/colors.gtk.css`), surfaced at
  `$XDG_CONFIG_HOME/ags/colors.css`. The engine's `barPalettePointer` contract
  verifies the link target at install time; the app only reapplies it through
  the Theme port. Never replace it with a palette copy, and never write it
  from the app.
- `icons.json` is a build/install artifact produced from the pinned
  `dotfiles-assets` tuple. Provisioning verifies it; no second producer.
- `audio/audio-panel.css` is deployed into the config dir; `app.tsx` applies it
  from `$XDG_CONFIG_HOME/ags/audio/audio-panel.css`, not from the tag.
- `wifi-speedtest.json` at the repo root is a legacy **seed default** owned by
  provisioning, not user state. The service reads/writes
  `$XDG_STATE_HOME/ags/wifi-speedtest.json` and
  `$XDG_STATE_HOME/ags/wifi-speedtest-last.json` (via
  `services/speedtest-state.ts`), with a one-time migration from the old
  `$XDG_CONFIG_HOME/ags/` files, which under the old deployment resolved inside
  the tag. The migration never writes the tag, never overwrites existing state,
  and never deletes the legacy source. Do not add writable state files to this
  repo, and do not reintroduce a config-dir read/write target.

## 4. Ticket flow

All work starts as a ticket in `tickets/` (`_template/`, vocab + rollup in
`INDEX.md`, flow in `LIFECYCLE.md`). App-local work is ticketed here; the
host-side cutover stays in `ags-apps` REQ-015 until archive.

Never work on main: `scripts/worktree-guard.sh check-clean` before starting and
`scripts/worktree-guard.sh create <id> <slug>` to branch + worktree. Record
`worktree=` and `branch=` in the ticket. Keep changes small, verifiable and
committable; never mix planning edits with implementation in one turn.

## 5. Local gates vs stock CI

**Local is authoritative for typecheck.** CI runs only stock-runner jobs
(`ubuntu-latest`): `make test`, `make conformance` and `make drift`. There is
no self-hosted runner and no CI secret dependency.

- `make test` — pure `tests/ts` unit suites, `tests/validation` suites, the
  symbol check and the test-program typecheck. Node only.
- `make conformance` — manifest identity, restart/no-handler, request surface,
  install-time/state documentation and the platform `checkAppRepo` gate.
- `make drift` — vendored generated contract + shared event client against the
  canonical `contracts` tuple.
- `make typecheck` — LOCAL: needs `ags` on PATH plus GIR/Astal; generates
  machine-specific `@girs/` and `env.d.ts` (gitignored).
- `make bundle` — LOCAL: `ags bundle app.tsx build/ags-bar.js`.
- `make gates` — all of the above.

The program tuple is `ags-platform` / `contracts` v0.3.0, local-only in this
run. `.dev/` is gitignored; never commit a fetched platform, `node_modules/`,
`@girs/`, generated `tsconfig.json` or bundle output.

## 6. Release

Releases are immutable annotated tags (`v0.1.1`, …). A published tag is never
moved. Installed tags are read-only; writable state lives under XDG paths, never
inside the tag. Tag only after `make gates` passes, and record the evidence in
the release ticket.
