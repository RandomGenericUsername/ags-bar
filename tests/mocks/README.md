# bar test mocks

Owner-approved mock HTML that shipped with the bar. Each mock is the design
acceptance reference for a bar surface; the mock<->code parity guards that
consume them (`wifi-`, `bluetooth-`, `battery-`, `audio-mock-parity`) live in
`ags-apps/scripts/` and stay there with the host-side migration.

These files were vendored into the bar tree from dotfiles-v3 so the fixtures
live with the surfaces they describe. They are carried here unchanged as
reference material; the app repo's gates do not run the Python parity scripts.

| file | original guard | original location |
| --- | --- | --- |
| `wifi-popup-mockup.html` | `scripts/wifi-mock-parity.py` | `dotfiles-v3/wifi-popup-mockup.html` |
| `battery-popup-mockup.html` | `scripts/battery-mock-parity.py` | `dotfiles-v3/battery-popup-mockup.html` |
| `bluetooth-panel.html` | `scripts/bluetooth-mock-parity.py` | `dotfiles-v3/openspec/changes/add-bluetooth-bar-popup/mockups/panel.html` |
| `audio-panel-redesign-concept.html` | `scripts/audio-mock-parity.py` | `dotfiles-v3/_bmad-output/.../mockups/audio-panel-redesign-concept.html` |
