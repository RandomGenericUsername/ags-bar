import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PORT = Number(process.env.REQ009_DEBUG_PORT || 9333);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCK = `file://${path.join(HERE, "mock.html")}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn("google-chrome-stable", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=/tmp/opencode/req009-chrome-${process.pid}`,
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore" });

async function waitForChrome() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("chrome did not expose the debug port");
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.opened = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id === undefined) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }
  async send(method, params = {}) {
    await this.opened;
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  if (!ok) console.log(`FAIL  ${name}${detail === undefined ? "" : `  -> ${JSON.stringify(detail)}`}`);
}

async function main() {
  await waitForChrome();
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((entry) => entry.type === "page");
  if (!page) throw new Error("no page target");
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  async function nav(query) {
    await cdp.send("Page.navigate", { url: MOCK + query });
    await sleep(220);
  }

  async function evaluate(fnBody) {
    const expression = `(${fnBody})()`;
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
    return result.value;
  }

  const snapshotFn = function () {
    const $ = (id) => document.getElementById(id);
    const panel = $("panel");
    const rect = panel.getBoundingClientRect();
    const bar = document.querySelector(".desktopbar").getBoundingClientRect();
    const foot = document.querySelector(".pop-foot").getBoundingClientRect();
    const body = $("popBody");
    const visible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && r.width > 0 && r.height > 0;
    };
    const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
    const html = document.documentElement.outerHTML;
    // Fixed UI labels only: device names are user data and may legitimately
    // be all-caps (TOZO, JBL, ANC). Dynamic strings that interpolate a device
    // name are excluded from the uppercase check; CSS text-transform is checked
    // everywhere it appears on a label class.
    const labelled = [
      ...panel.querySelectorAll(
        ".sect-label, .nearby-label, .head-title, .foot-title, .foot-sub, " +
        ".pill, .badge, .state-title, .state-copy, .empty-title, .empty-copy, " +
        ".adapter-line, .scan-cue, .dev-note"
      ),
    ];
    const labelText = labelled.map((el) => el.innerText || el.textContent || "").join(" ").replace(/\s+/g, " ");
    const noMac = labelText.replace(/[0-9A-F]{2}(?::[0-9A-F]{2}){5}/g, " ");
    const upper = noMac.match(/\b[A-Z]{2,}\b/g) || [];
    const transforms = labelled
      .map((el) => getComputedStyle(el).textTransform)
      .filter((value) => value !== "none");
    const names = [...panel.querySelectorAll(".dev-name")];
    const scanCue = $("scanCue");
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      width: Math.round(rect.width),
      offsetWidth: panel.offsetWidth,
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
      barBottom: bar.bottom,
      foot: { top: foot.top, bottom: foot.bottom },
      footReachable: foot.top >= 0 && foot.bottom <= window.innerHeight + 0.5 && foot.bottom <= rect.bottom + 0.5,
      bodyOverflow: getComputedStyle(body).overflowY,
      keyboard: panel.getAttribute("data-keyboard"),
      externalAsset: /https?:\/\//.test(html) || /url\s*\(/.test(html),
      inputCount: document.querySelectorAll("input, textarea, select, [contenteditable='true']").length,
      assetNodes: document.querySelectorAll("img, link[rel='stylesheet'], script[src], iframe, object, embed").length,
      chevrons: panel.querySelectorAll(".expander-chev").length,
      chevronChars: /[›▸▾»]/.test(panel.innerText),
      upper,
      transforms,
      headSub: text($("headSub")),
      switchChecked: $("powerSwitch").getAttribute("aria-checked"),
      switchDisabled: $("powerSwitch").disabled,
      stateVisible: visible($("stateBlock")),
      stateTitle: text($("stateTitle")),
      connectedCount: panel.querySelectorAll(".dev-card").length,
      pairedCount: panel.querySelectorAll("#pairedList .dev-row").length,
      nearbyCount: panel.querySelectorAll("#nearbyList .dev-row").length,
      adjacentCount: text($("nearbyCount")),
      nearbyExpanded: $("nearbyToggle").getAttribute("aria-expanded"),
      nearbyControls: $("nearbyToggle").getAttribute("aria-controls"),
      nearbyBodyVisible: visible($("nearbyBody")),
      scanCueVisible: visible(scanCue),
      scanPlaceholderVisible: visible($("scanPlaceholder")),
      idleEmptyVisible: visible($("idleEmpty")),
      emptyTitle: text(document.querySelector("#idleEmpty .empty-title")),
      emptyCopy: text(document.querySelector("#idleEmpty .empty-copy")),
      adapterVisible: visible($("adapterLine")),
      adapterText: text($("adapterLine")),
      footerVisible: visible(document.querySelector(".pop-foot")),
      footerText: text(document.querySelector(".pop-foot")),
      connectedSection: visible($("connectedSection")),
      pairedSection: visible($("pairedSection")),
      nearbySection: visible($("nearbySection")),
      batteryTexts: [...panel.querySelectorAll("#connectedList .meta-stat")].map((el) => text(el)),
      pairedHasPercent: /%/.test(text($("pairedList"))),
      signalTitles: [...panel.querySelectorAll(".sig[title]")].map((el) => el.getAttribute("title")),
      busyLabels: [...panel.querySelectorAll("#panel, .dev-row, .dev-card")].map((el) => text(el)).filter((value) => /ing…|Can take up to 30 s/.test(value)),
      panelText: panel.innerText.replace(/\s+/g, " ").trim(),
      cardHeight: panel.querySelector(".dev-card") ? Math.round(panel.querySelector(".dev-card").getBoundingClientRect().height) : null,
      pairedRowHeight: panel.querySelector("#pairedList .dev-row") ? Math.round(panel.querySelector("#pairedList .dev-row").getBoundingClientRect().height) : null,
      outOfRange: panel.querySelectorAll("#pairedList .dev-row.out-of-range").length,
      longEllipsis: names.some((el) => el.scrollWidth > el.clientWidth + 1),
      longTitles: names.map((el) => el.getAttribute("title")),
      confirmingCards: panel.querySelectorAll(".dev-card.is-confirming").length,
      confirmingRows: panel.querySelectorAll("#pairedList .dev-row.is-confirming").length,
      confirmQuestions: [...panel.querySelectorAll(".confirm-q")].map((el) => text(el)),
      confirmSubs: [...panel.querySelectorAll("#pairedList .dev-row.is-confirming .dev-sub")].map((el) => text(el)),
      keepButtons: [...panel.querySelectorAll("[data-act='keep']")].map((el) => text(el)),
      unpairDeviceButtons: [...panel.querySelectorAll("[data-act='unpair-device']")].map((el) => text(el)),
      disconnectButtons: panel.querySelectorAll("[data-act='disconnect']").length,
      connectDisabled: [...panel.querySelectorAll("#pairedList [data-act='connect']")].map((el) => el.disabled),
      pairDisabled: [...panel.querySelectorAll("#nearbyList [data-act='pair']")].map((el) => el.disabled),
      busyRows: panel.querySelectorAll(".dev-row.is-busy").length,
      busyCards: panel.querySelectorAll(".dev-card.is-busy").length,
      actionStates: [...panel.querySelectorAll("[data-act]")].map((el) => ({
        act: el.dataset.act,
        id: el.dataset.id,
        disabled: el.disabled,
        inBusyRow: Boolean(el.closest(".is-busy")),
      })),
      spinnerInPanel: panel.querySelectorAll(".spinner").length,
      bodyClosed: document.body.classList.contains("is-closed"),
      barExpanded: $("barBluetooth").getAttribute("aria-expanded"),
      barActive: $("barBluetooth").classList.contains("is-active"),
      panelVisibility: getComputedStyle(panel).visibility,
    };
  }

  async function snap(query) {
    await nav(query);
    return evaluate(snapshotFn);
  }

  /* ── geometry + static invariants for every case, both sizes ── */

  const cases = [
    { query: "", name: "connected" },
    { query: "?state=multi&multi=1", name: "multi" },
    { query: "?nearby=0", name: "nearby-0" },
    { query: "?nearby=1", name: "nearby-1" },
    { query: "?state=scanning", name: "scanning" },
    { query: "?state=empty", name: "empty" },
    { query: "?state=off", name: "off" },
    { query: "?state=noadapter", name: "noadapter" },
    { query: "?state=busy&action=pair&device=speaker", name: "busy-pair" },
    { query: "?state=busy&action=connect&device=keyboard", name: "busy-connect" },
    { query: "?state=busy&action=disconnect&device=headset", name: "busy-disconnect" },
    { query: "?state=busy&action=unpair&device=headset", name: "busy-unpair" },
    { query: "?state=confirm&device=headset", name: "confirm-card" },
    { query: "?state=confirm&device=keyboard", name: "confirm-row" },
    { query: "?outofrange=1", name: "outofrange" },
    { query: "?long=1", name: "long" },
    { query: "?unknown=1", name: "unknown" },
    { query: "?adapter=AA:BB:CC:DD:EE:FF", name: "adapter" },
    { query: "?panel=closed", name: "closed" },
  ];

  for (const size of [{ width: 1600, height: 1000 }, { width: 1280, height: 800 }]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false,
    });
    for (const testCase of cases) {
      const s = await snap(testCase.query);
      const prefix = `${size.width}x${size.height} ${testCase.name}`;

      check(`${prefix}: width 352`,
        testCase.name === "closed" ? s.offsetWidth === 352 : (s.width === 352 && s.offsetWidth === 352),
        { rect: s.width, offset: s.offsetWidth });
      if (testCase.name !== "closed") {
        check(`${prefix}: anchored 8px under bar`,
          Math.round(s.rect.top) === Math.round(s.barBottom + 8), { top: s.rect.top, barBottom: s.barBottom });
      }
      check(`${prefix}: no external URL/asset`, !s.externalAsset && s.assetNodes === 0);
      check(`${prefix}: no <input>`, s.inputCount === 0, s.inputCount);
      check(`${prefix}: data-keyboard=none`, s.keyboard === "none", s.keyboard);
      check(`${prefix}: only one chevron`, s.chevrons === 1 && !s.chevronChars, { chevrons: s.chevrons, chars: s.chevronChars });
      check(`${prefix}: no uppercase micro-labels`, s.upper.length === 0 && s.transforms.length === 0,
        { upper: s.upper, transforms: s.transforms });
      check(`${prefix}: nearby aria-expanded/controls`,
        (s.nearbyExpanded === "true" || s.nearbyExpanded === "false") && s.nearbyControls === "nearbyBody",
        { expanded: s.nearbyExpanded, controls: s.nearbyControls });
      check(`${prefix}: nearby count visible`, /^\(\d+\)$/.test(s.adjacentCount), s.adjacentCount);
      if (testCase.name !== "closed") {
        check(`${prefix}: footer reachable`, s.footerVisible && s.footReachable,
          { visible: s.footerVisible, foot: s.foot, rect: s.rect, vh: s.innerHeight });
        check(`${prefix}: no viewport overflow`,
          s.rect.left >= 0 && s.rect.right <= s.innerWidth + 0.5 &&
          s.rect.bottom <= s.innerHeight + 0.5 &&
          s.scrollWidth <= s.innerWidth && s.scrollHeight <= s.innerHeight,
          { rect: s.rect, scroll: [s.scrollWidth, s.scrollHeight], viewport: [s.innerWidth, s.innerHeight] });
      }
      check(`${prefix}: scroll body owns overflow`, s.bodyOverflow === "auto", s.bodyOverflow);
    }
  }

  /* ── state-specific assertions at 1600x1000 ── */

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  const connected = await snap("");
  check("connected: header subtitle", connected.headSub === "Connected to TOZO NC9", connected.headSub);
  check("connected: one connected card", connected.connectedCount === 1, connected.connectedCount);
  check("connected: two paired rows", connected.pairedCount === 2, connected.pairedCount);
  check("connected: two nearby rows", connected.nearbyCount === 2, connected.nearbyCount);
  check("connected: Nearby auto-expanded", connected.nearbyExpanded === "true" && connected.nearbyBodyVisible);
  check("connected: battery only on connected", connected.batteryTexts.length === 1 && connected.batteryTexts[0].includes("85%") && !connected.pairedHasPercent,
    { connected: connected.batteryTexts, pairedHasPercent: connected.pairedHasPercent });
  check("connected: exact dBm tooltip", connected.signalTitles.includes("Signal: −58 dBm"), connected.signalTitles);
  check("connected: out-of-range mouse", connected.outOfRange === 1 && connected.connectDisabled.includes(true),
    { outOfRange: connected.outOfRange, disabled: connected.connectDisabled });
  check("connected: adapter line", connected.adapterVisible && connected.adapterText.includes("A4:7B:9D:2C:60:1F"), connected.adapterText);
  check("connected: footer copy", connected.footerVisible && /Bluetooth Settings/.test(connected.footerText) && /opens Blueman/.test(connected.footerText), connected.footerText);
  check("connected: bar icon highlighted", connected.barActive && connected.barExpanded === "true");

  const multi = await snap("?state=multi&multi=1");
  check("multi: two connected cards", multi.connectedCount === 2, multi.connectedCount);
  check("multi: header says two connected", multi.headSub === "2 devices connected", multi.headSub);
  check("multi: no duplicate paired keyboard", multi.pairedCount === 1 && !/MX Keys Mini/.test(multi.panelText.split("Paired")[1] || ""),
    { paired: multi.pairedCount, text: multi.panelText });
  check("multi: both connected cards carry battery", multi.batteryTexts.length === 2 && multi.batteryTexts.join(" ").includes("85%") && multi.batteryTexts.join(" ").includes("64%"),
    multi.batteryTexts);

  const collapsed = await snap("?nearby=0");
  check("nearby=0: collapsed", collapsed.nearbyExpanded === "false" && !collapsed.nearbyBodyVisible);
  check("nearby=0: count + scanning cue remain", collapsed.adjacentCount === "(2)" && collapsed.scanCueVisible,
    { count: collapsed.adjacentCount, cue: collapsed.scanCueVisible });

  const expanded = await snap("?nearby=1");
  check("nearby=1: expanded", expanded.nearbyExpanded === "true" && expanded.nearbyBodyVisible);

  const scanning = await snap("?state=scanning");
  check("scanning: header cue", scanning.headSub === "Scanning…", scanning.headSub);
  check("scanning: centred placeholder", scanning.scanPlaceholderVisible && !scanning.scanCueVisible && !scanning.idleEmptyVisible,
    { placeholder: scanning.scanPlaceholderVisible, cue: scanning.scanCueVisible, idle: scanning.idleEmptyVisible });
  check("scanning: count zero", scanning.adjacentCount === "(0)", scanning.adjacentCount);

  const empty = await snap("?state=empty");
  check("empty: header On + idle", empty.headSub === "On", empty.headSub);
  check("empty: No devices found copy", empty.idleEmptyVisible && empty.emptyTitle === "No devices found" && empty.emptyCopy === "Make sure the device is in pairing mode.",
    { title: empty.emptyTitle, copy: empty.emptyCopy });
  check("empty: no placeholder", !empty.scanPlaceholderVisible);

  const off = await snap("?state=off");
  check("off: header + state copy", off.headSub === "Bluetooth off" && off.stateVisible && off.stateTitle === "Bluetooth is off", { head: off.headSub, title: off.stateTitle });
  check("off: no device sections", !off.connectedSection && !off.pairedSection && !off.nearbySection);
  check("off: adapter line hidden", !off.adapterVisible);
  check("off: switch off but usable", off.switchChecked === "false" && off.switchDisabled === false, { checked: off.switchChecked, disabled: off.switchDisabled });
  check("off: footer remains", off.footerVisible);

  const noadapter = await snap("?state=noadapter");
  check("noadapter: header + switch disabled", noadapter.headSub === "No adapter" && noadapter.switchDisabled === true, { head: noadapter.headSub, disabled: noadapter.switchDisabled });
  check("noadapter: explicit copy", noadapter.stateVisible && noadapter.stateTitle === "No Bluetooth adapter found on this system.", noadapter.stateTitle);
  check("noadapter: no device sections or adapter", !noadapter.connectedSection && !noadapter.pairedSection && !noadapter.nearbySection && !noadapter.adapterVisible);
  check("noadapter: footer remains", noadapter.footerVisible);

  const busyPair = await snap("?state=busy&action=pair&device=speaker");
  check("busy pair: row busy + copy", busyPair.busyRows === 1 && /Pairing…/.test(busyPair.panelText) && /Can take up to 30 s/.test(busyPair.panelText),
    { rows: busyPair.busyRows, text: busyPair.panelText });
  check("busy pair: other Pair disabled", busyPair.pairDisabled.includes(true), busyPair.pairDisabled);
  check("busy pair: single-flight disables every other action",
    busyPair.actionStates.every((entry) => entry.inBusyRow || entry.disabled), busyPair.actionStates);
  check("busy pair: spinner visible", busyPair.spinnerInPanel >= 1, busyPair.spinnerInPanel);

  const busyConnect = await snap("?state=busy&action=connect&device=keyboard");
  check("busy connect: row busy + copy", busyConnect.busyRows === 1 && /Connecting…/.test(busyConnect.panelText) && /Can take up to 30 s/.test(busyConnect.panelText));
  check("busy connect: single-flight disables every other action",
    busyConnect.actionStates.every((entry) => entry.inBusyRow || entry.disabled), busyConnect.actionStates);

  const busyDisconnect = await snap("?state=busy&action=disconnect&device=headset");
  check("busy disconnect: card busy + copy", busyDisconnect.busyCards === 1 && /Disconnecting…/.test(busyDisconnect.panelText) && /Can take up to 30 s/.test(busyDisconnect.panelText));
  check("busy disconnect: single-flight disables every other action",
    busyDisconnect.actionStates.every((entry) => entry.inBusyRow || entry.disabled), busyDisconnect.actionStates);

  const busyUnpair = await snap("?state=busy&action=unpair&device=headset");
  check("busy unpair: card busy + copy", busyUnpair.busyCards === 1 && /Unpairing…/.test(busyUnpair.panelText) && /Can take up to 30 s/.test(busyUnpair.panelText));
  check("busy unpair: single-flight disables every other action",
    busyUnpair.actionStates.every((entry) => entry.inBusyRow || entry.disabled), busyUnpair.actionStates);

  const confirmCard = await snap("?state=confirm&device=headset");
  check("confirm card: question + actions", confirmCard.confirmingCards === 1 &&
    confirmCard.confirmQuestions.some((q) => q.includes("Remove TOZO NC9 from paired devices?")) &&
    confirmCard.keepButtons.includes("Keep") && confirmCard.unpairDeviceButtons.includes("Unpair device") &&
    confirmCard.disconnectButtons === 0,
    { q: confirmCard.confirmQuestions, keep: confirmCard.keepButtons, unpair: confirmCard.unpairDeviceButtons });
  check("confirm card: no reflow", confirmCard.cardHeight === connected.cardHeight,
    { confirm: confirmCard.cardHeight, connected: connected.cardHeight });

  const confirmRow = await snap("?state=confirm&device=keyboard");
  check("confirm row: question + actions", confirmRow.confirmingRows === 1 &&
    confirmRow.confirmSubs.includes("Remove from paired devices") &&
    confirmRow.keepButtons.includes("Keep") && confirmRow.unpairDeviceButtons.includes("Unpair device"),
    { subs: confirmRow.confirmSubs });
  check("confirm row: no reflow", confirmRow.pairedRowHeight === connected.pairedRowHeight,
    { confirm: confirmRow.pairedRowHeight, connected: connected.pairedRowHeight });

  const outofrange = await snap("?outofrange=1");
  check("outofrange: both paired rows dimmed", outofrange.outOfRange === 2, outofrange.outOfRange);
  check("outofrange: Not in range + Connect disabled", /Not in range/.test(outofrange.panelText) && outofrange.connectDisabled.every(Boolean),
    outofrange.connectDisabled);

  const long = await snap("?long=1");
  check("long: names ellipsized with tooltip", long.longEllipsis && long.longTitles.some((t) => t && t.length > 24),
    { ellipsis: long.longEllipsis, titles: long.longTitles });

  const unknown = await snap("?unknown=1");
  check("unknown: adapter address is —", unknown.adapterVisible && /Adapter\s+—$/.test(unknown.adapterText), unknown.adapterText);

  const adapter = await snap("?adapter=AA:BB:CC:DD:EE:FF");
  check("adapter override", adapter.adapterText.includes("AA:BB:CC:DD:EE:FF"), adapter.adapterText);

  const closed = await snap("?panel=closed");
  check("panel=closed: hidden", closed.bodyClosed && closed.panelVisibility === "hidden" && closed.barExpanded === "false",
    { closed: closed.bodyClosed, visibility: closed.panelVisibility, bar: closed.barExpanded });

  /* ── interaction smoke ── */

  await nav("");
  await evaluate(function () { document.getElementById("nearbyToggle").click(); return true; });
  let s = await evaluate(snapshotFn);
  check("interaction: Nearby toggle collapses", s.nearbyExpanded === "false" && !s.nearbyBodyVisible, s.nearbyExpanded);
  await evaluate(function () { document.getElementById("nearbyToggle").click(); return true; });
  s = await evaluate(snapshotFn);
  check("interaction: Nearby toggle expands", s.nearbyExpanded === "true" && s.nearbyBodyVisible, s.nearbyExpanded);

  await evaluate(function () { document.getElementById("bluetoothSettings").click(); return true; });
  await sleep(80);
  s = await evaluate(function () {
    const toast = document.getElementById("toast");
    return { open: toast.classList.contains("is-open"), text: toast.textContent };
  });
  check("interaction: footer toast", s.open && /blueman-manager/.test(s.text), s);

  await evaluate(function () { document.getElementById("powerSwitch").click(); return true; });
  s = await evaluate(snapshotFn);
  check("interaction: switch off", s.headSub === "Bluetooth off" && s.stateVisible, s.headSub);
  await evaluate(function () { document.getElementById("powerSwitch").click(); return true; });
  s = await evaluate(snapshotFn);
  check("interaction: switch on", s.headSub === "Connected to TOZO NC9", s.headSub);

  await evaluate(function () { document.querySelector("[data-act='unpair'][data-id='keyboard']").click(); return true; });
  s = await evaluate(snapshotFn);
  check("interaction: Unpair opens inline confirm", s.confirmingRows === 1, s.confirmingRows);
  await evaluate(function () { document.querySelector("[data-act='keep']").click(); return true; });
  s = await evaluate(snapshotFn);
  check("interaction: Keep dismisses confirm", s.confirmingRows === 0, s.confirmingRows);

  await evaluate(function () { document.querySelector("[data-act='unpair'][data-id='headset']").click(); return true; });
  await evaluate(function () { document.querySelector("[data-act='connect'][data-id='keyboard']").click(); return true; });
  await sleep(120);
  s = await evaluate(snapshotFn);
  const confirmUnpairButton = s.actionStates.find((entry) => entry.act === "unpair-device");
  check("interaction: another action keeps an open confirm, disabled by single-flight",
    s.confirmingCards === 1 && s.busyRows === 1 && confirmUnpairButton && confirmUnpairButton.disabled,
    { confirm: s.confirmingCards, busy: s.busyRows, button: confirmUnpairButton });
  await sleep(1500);
  s = await evaluate(snapshotFn);
  const confirmUnpairButtonAfter = s.actionStates.find((entry) => entry.act === "unpair-device");
  check("interaction: confirm re-enables after the other action resolves",
    s.confirmingCards === 1 && s.busyRows === 0 && confirmUnpairButtonAfter && !confirmUnpairButtonAfter.disabled,
    { confirm: s.confirmingCards, busy: s.busyRows, button: confirmUnpairButtonAfter });
  await evaluate(function () { document.querySelector("[data-act='keep']").click(); return true; });

  await nav("");
  await evaluate(function () { document.querySelector("[data-act='connect'][data-id='keyboard']").click(); return true; });
  await sleep(120);
  s = await evaluate(snapshotFn);
  check("interaction: Connect shows busy", s.busyRows === 1 && /Connecting…/.test(s.panelText), s.panelText);
  await sleep(1500);
  s = await evaluate(snapshotFn);
  check("interaction: Connect resolves to 2 connected", s.connectedCount === 2 && s.busyRows === 0, { cards: s.connectedCount, busy: s.busyRows });

  await nav("");
  await evaluate(function () { document.querySelector("[data-act='pair'][data-id='speaker']").click(); return true; });
  await sleep(1500);
  s = await evaluate(snapshotFn);
  check("interaction: Pair resolves into connected card", s.connectedCount === 2 && s.nearbyCount === 1 && s.busyRows === 0,
    { cards: s.connectedCount, nearby: s.nearbyCount, busy: s.busyRows });

  await nav("");
  await evaluate(function () { document.querySelector("[data-act='unpair'][data-id='headset']").click(); return true; });
  await evaluate(function () { document.querySelector("[data-act='unpair-device']").click(); return true; });
  await sleep(1500);
  s = await evaluate(snapshotFn);
  check("interaction: Unpair device removes the card", s.connectedCount === 0 && s.busyCards === 0,
    { cards: s.connectedCount, busy: s.busyCards });

  /* ── report ── */

  const passed = results.filter((entry) => entry.ok).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} checks passed; ${failed} failed.`);
  cdp.close();
  chrome.kill("SIGTERM");
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  chrome.kill("SIGTERM");
  process.exit(1);
});
