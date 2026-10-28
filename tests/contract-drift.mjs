// ---------------------------------------------------------------------------
// Contract drift + generated-artifact gate for the bar.
//
// Pins the SHARED platform event client (spine AD-5,
// `ags-platform/ports/event-client`) and the bar's vendored generated contract
// (`lib/generated/contract.ts`) against the canonical contract
// (`contracts/event-contract.json` / `.xml`). Executed, never text-scanned.
//
// The bar consumes the hub only through the platform adapter; the generated
// file is a build artifact checked in with the app. A missing contract FAILS --
// a drift gate that cannot read the contract proves nothing.
//
// Run from the repo root:  make drift
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "ags-platform/ports/event-client";
import * as generated from "../lib/generated/contract.ts";

const here = dirname(fileURLToPath(import.meta.url));

function findContractsRepo() {
  const override = process.env.CONTRACTS_REPO;
  if (override) return override;
  let dir = here;
  for (let i = 0; i < 8; i += 1) {
    dir = dirname(dir);
    if (existsSync(join(dir, "contracts", "event-contract.json"))) {
      return join(dir, "contracts");
    }
  }
  return null;
}

const contractsRepo = findContractsRepo();
if (contractsRepo === null) {
  console.error(
    "FAIL: cannot find the `contracts` repo (set CONTRACTS_REPO=/path/to/contracts)",
  );
  process.exit(1);
}

const contractJson = JSON.parse(
  readFileSync(join(contractsRepo, "event-contract.json"), "utf-8"),
);
const contractXml = readFileSync(
  join(contractsRepo, "event-contract.xml"),
  "utf-8",
);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures += 1;
    console.error(`FAIL ${name}\n  expected: ${e}\n  actual:   ${a}`);
  } else {
    console.log(`ok ${name}`);
  }
}

// ── Drift: the shared client's baked constants ─────────────────────────────

check("shared client bus name", core.EVENTS_BUS_NAME, contractJson.well_known_name);
check("shared client object path", core.EVENTS_OBJECT_PATH, contractJson.object_path);
check("shared client interface", core.EVENTS_INTERFACE, contractJson.interface);
check("shared client DomainEvent signal", contractJson.signals[core.DOMAIN_EVENT_SIGNAL] !== undefined, true);
check("shared client JobsCleared signal", contractJson.signals[core.JOBS_CLEARED_SIGNAL] !== undefined, true);
check("shared client Control method", contractJson.methods[core.CONTROL_METHOD] !== undefined, true);
check("shared client GetTopicState method", contractJson.methods[core.HYDRATION_METHOD] !== undefined, true);
check(
  "shared client GetTopicState returns reserved _epoch/_seq",
  contractJson.methods.GetTopicState.out,
  ["state:a{sv}"],
);
check("xml declares the hub interface", contractXml.includes(core.EVENTS_INTERFACE), true);

// ── Drift: the vendored generated contract ─────────────────────────────────

check("generated bus name", generated.EVENTS_BUS_NAME, contractJson.well_known_name);
check("generated object path", generated.EVENTS_OBJECT_PATH, contractJson.object_path);
check("generated interface", generated.EVENTS_INTERFACE, contractJson.interface);
check(
  "generated signals match the contract",
  Object.keys(generated.EVENTS_SIGNALS).sort(),
  Object.keys(contractJson.signals).sort(),
);
check(
  "generated methods match the contract",
  Object.keys(generated.EVENTS_METHODS).sort(),
  Object.keys(contractJson.methods).sort(),
);
check(
  "generated topics match the contract",
  Object.keys(generated.EVENTS_TOPICS).sort(),
  Object.keys(contractJson.topics).sort(),
);
check(
  "the bar's speedtest topic is a contract topic",
  contractJson.topics["speedtest.state"] !== undefined,
  true,
);
check(
  "the bar's wallpaper progress topic is a contract topic",
  contractJson.topics["wallpaper.state"] !== undefined,
  true,
);
check(
  "speedtest.state payload keys",
  Object.keys(contractJson.topics["speedtest.state"].payload).sort(),
  ["down_mbps", "latency_ms", "reason", "server_name", "ssid", "state", "trigger", "up_mbps"],
);
check(
  "speedtest.state enum",
  contractJson.topics["speedtest.state"].enum.state,
  ["starting", "done", "error"],
);
check(
  "speedtest trigger enum",
  contractJson.topics["speedtest.state"].enum.trigger,
  ["scheduled", "manual", "connect"],
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
