// ---------------------------------------------------------------------------
// The bar's capture-cluster request client (SPIKE-003 option B).
//
// Transport is the existing AGS request channel, not a new event topic:
//
//   ags request capture-cluster '<json>' -i capture
//
// `exec` is injected so the argv/timeout/parse/coalescing rules run under the
// stock test runner with no AGS process. The live adapter passes `execAsync`.
//
// PURE: no AGS or GObject imports, no I/O of its own.
// ---------------------------------------------------------------------------

import {
  CAPTURE_CLUSTER_COMMAND,
  type ClusterRequest,
  type ClusterResponse,
} from "ags-platform/ports/capture-cluster"
import { popoverCloseRequest } from "../domain/cluster-slot.ts"

export type ClusterExec = (argv: readonly string[]) => Promise<string>

export interface ClusterTimers {
  setTimeout(callback: () => void, milliseconds: number): unknown
  clearTimeout(id: unknown): void
}

export interface ClusterClientOptions {
  readonly exec: ClusterExec
  readonly instance?: string
  readonly timeoutMs?: number
  readonly timers?: ClusterTimers
}

const DEFAULT_TIMEOUT_MS = 1000

function transportFailure(): ClusterResponse {
  return { ok: false, error: "transport", retryable: true }
}

/** Parse exactly one response string. Non-JSON is a retryable bad response. */
export function parseClusterResponse(output: string): ClusterResponse {
  let value: unknown
  try {
    value = JSON.parse(output.trim()) as unknown
  } catch {
    return { ok: false, error: "bad-response", retryable: true }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "bad-response", retryable: true }
  }
  const record = value as Record<string, unknown>
  if (record.ok === true) return { ok: true }
  if (record.ok === false) {
    return {
      ok: false,
      error: typeof record.error === "string" ? record.error : "unknown",
      retryable: record.retryable === true,
    }
  }
  return { ok: false, error: "bad-response", retryable: true }
}

export class CaptureClusterClient {
  private readonly exec: ClusterExec
  private readonly instance: string
  private readonly timeoutMs: number
  private readonly timers: ClusterTimers
  private inFlight: Promise<ClusterResponse> | null = null
  private queued:
    | { request: ClusterRequest; resolve: (response: ClusterResponse) => void }
    | null = null

  constructor(options: ClusterClientOptions) {
    this.exec = options.exec
    this.instance = options.instance ?? "capture"
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.timers = options.timers ?? {
      setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
      clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    }
  }

  /**
   * Send one request. While one is in flight, only the LATEST later request is
   * kept; superseded queued requests resolve `{ok:true}` because they were
   * intentionally not sent.
   */
  send(request: ClusterRequest): Promise<ClusterResponse> {
    if (this.inFlight === null) return this.start(request)
    return new Promise((resolve) => {
      this.queued?.resolve({ ok: true })
      this.queued = { request, resolve }
    })
  }

  /** The global Esc path: no anchor, because it targets the open popover. */
  popoverClose(): Promise<ClusterResponse> {
    return this.send(popoverCloseRequest(0))
  }

  private start(request: ClusterRequest): Promise<ClusterResponse> {
    const promise = this.invoke(request)
    this.inFlight = promise
    void promise.finally(() => {
      if (this.inFlight === promise) this.inFlight = null
      const next = this.queued
      this.queued = null
      if (next) {
        void this.start(next.request).then((response) => next.resolve(response))
      }
    })
    return promise
  }

  private async invoke(request: ClusterRequest): Promise<ClusterResponse> {
    const argv = [
      "ags",
      "request",
      CAPTURE_CLUSTER_COMMAND,
      JSON.stringify(request),
      "-i",
      this.instance,
    ]

    let timer: unknown
    const timeout = new Promise<ClusterResponse>((resolve) => {
      timer = this.timers.setTimeout(
        () => resolve({ ok: false, error: "timeout", retryable: true }),
        this.timeoutMs,
      )
    })

    const call = this.exec(argv)
      .then((output) => parseClusterResponse(output))
      .catch(() => transportFailure())

    try {
      return await Promise.race([call, timeout])
    } finally {
      this.timers.clearTimeout(timer)
    }
  }
}

/** The app adapter (kept out of the pure module) constructs one of these. */
export function createCaptureClusterClient(
  options: ClusterClientOptions,
): CaptureClusterClient {
  return new CaptureClusterClient(options)
}
