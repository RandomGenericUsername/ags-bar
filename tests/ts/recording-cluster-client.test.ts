import { test } from "node:test"
import assert from "node:assert/strict"
import type { ClusterRequest } from "ags-platform/ports/capture-cluster"
import {
  CaptureClusterClient,
  parseClusterResponse,
} from "../../lib/cluster-request.ts"

function request(command: "show" | "update", seq = 1): ClusterRequest {
  return {
    v: 1,
    command,
    seq,
    compact: true,
    anchor: {
      connector: "eDP-1",
      monitorX: 0,
      monitorY: 0,
      monitorWidth: 1920,
      monitorHeight: 1080,
      scale: 1,
      x: 10,
      y: 10,
      width: 76,
      height: 38,
      edge: "top",
    },
  }
}

test("the live argv is the existing AGS request channel", async () => {
  const calls: string[][] = []
  const client = new CaptureClusterClient({
    exec: async (argv) => {
      calls.push([...argv])
      return '{"ok":true}'
    },
  })

  assert.deepEqual(await client.send(request("show", 7)), { ok: true })
  assert.deepEqual(calls, [
    [
      "ags",
      "request",
      "capture-cluster",
      JSON.stringify(request("show", 7)),
      "-i",
      "capture",
    ],
  ])
})

test("responses and transport failures are classified, never thrown", async () => {
  assert.deepEqual(parseClusterResponse('{"ok":true}\n'), { ok: true })
  assert.deepEqual(parseClusterResponse('{"ok":false,"error":"unknown-monitor","retryable":true}'), {
    ok: false,
    error: "unknown-monitor",
    retryable: true,
  })
  assert.deepEqual(parseClusterResponse("not json"), {
    ok: false,
    error: "bad-response",
    retryable: true,
  })

  const client = new CaptureClusterClient({
    exec: async () => {
      throw new Error("no capture instance")
    },
  })
  assert.deepEqual(await client.send(request("show")), {
    ok: false,
    error: "transport",
    retryable: true,
  })
})

test("a hung request times out after the configured budget", async () => {
  let timeout: (() => void) | null = null
  const client = new CaptureClusterClient({
    exec: () => new Promise(() => {}),
    timeoutMs: 1000,
    timers: {
      setTimeout(callback) {
        timeout = callback
        return 1
      },
      clearTimeout() {},
    },
  })

  const pending = client.send(request("show"))
  assert.notEqual(timeout, null)
  timeout!()
  assert.deepEqual(await pending, {
    ok: false,
    error: "timeout",
    retryable: true,
  })
})

test("one request is in flight and the latest queued update wins", async () => {
  const calls: string[][] = []
  const pending: Array<(output: string) => void> = []
  const client = new CaptureClusterClient({
    exec: (argv) => {
      calls.push([...argv])
      return new Promise((resolve) => pending.push(resolve))
    },
  })

  const first = client.send(request("show", 1))
  const superseded = client.send(request("update", 2))
  const latest = client.send(request("update", 3))

  assert.equal(calls.length, 1)
  assert.deepEqual(await superseded, { ok: true })

  pending[0]('{"ok":true}')
  assert.deepEqual(await first, { ok: true })
  await Promise.resolve()
  assert.equal(calls.length, 2)
  assert.equal(JSON.parse(calls[1][3]).seq, 3)

  pending[1]('{"ok":true}')
  assert.deepEqual(await latest, { ok: true })
})

test("the Esc path sends popover-close without an anchor", async () => {
  let argv: readonly string[] = []
  const client = new CaptureClusterClient({
    exec: async (value) => {
      argv = value
      return '{"ok":true}'
    },
  })
  await client.popoverClose()
  assert.equal(argv[2], "capture-cluster")
  assert.deepEqual(JSON.parse(argv[3]), {
    v: 1,
    command: "popover-close",
    seq: 0,
    compact: false,
  })
})
