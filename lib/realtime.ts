import { ApiError } from "@/api/client"

// Generic client for the services' realtime WebSockets (ADR 0006, contract in
// documentacion/tiempo-real.md). KrakenD CE can't proxy WebSockets, so the
// client asks the gateway for a single-use ticket (JWT-protected, like any
// other route) and opens the socket straight against the service with it.
// Voice uses it for HU-20 presence; messages can reuse it with its own ticket.

export interface RealtimeTicket {
  url: string
  ticket: string
  expires_in: number
}

export interface RealtimeMessage {
  type: string
  [key: string]: unknown
}

export type RealtimeStatus = "connecting" | "open" | "closed"

export interface RealtimeOptions {
  // Asks the gateway for a fresh ticket. Called on every (re)connect: tickets
  // are single-use and expire in seconds.
  getTicket: () => Promise<RealtimeTicket>
  onMessage: (msg: RealtimeMessage) => void
  onStatus?: (status: RealtimeStatus) => void
}

// Close codes the services use (documentacion/tiempo-real.md).
const CLOSE_NORMAL = 1000
const CLOSE_INVALID_TICKET = 4401
const CLOSE_ACCESS_LOST = 4403

const MIN_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000

export class RealtimeConnection {
  private ws: WebSocket | null = null
  private subscriptions = new Set<string>()
  private stopped = true
  private attempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: RealtimeOptions) {}

  start() {
    if (!this.stopped) return
    this.stopped = false
    this.attempt = 0
    void this.connect()
  }

  stop() {
    this.stopped = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    const ws = this.ws
    this.ws = null
    ws?.close(CLOSE_NORMAL)
    this.options.onStatus?.("closed")
  }

  // Subscriptions survive reconnects: they are replayed on every open, and
  // every service answers a subscribe with the full current state.
  subscribe(ids: string[]) {
    const added = ids.filter((id) => !this.subscriptions.has(id))
    added.forEach((id) => this.subscriptions.add(id))
    if (added.length > 0) this.send({ type: "subscribe", channel_ids: added })
  }

  unsubscribe(ids: string[]) {
    const removed = ids.filter((id) => this.subscriptions.delete(id))
    if (removed.length > 0) this.send({ type: "unsubscribe", channel_ids: removed })
  }

  private send(msg: RealtimeMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  private async connect() {
    if (this.stopped) return
    this.options.onStatus?.("connecting")

    let ticket: RealtimeTicket
    try {
      ticket = await this.options.getTicket()
    } catch (err) {
      // 401: the session is over; the auth flow takes it from here.
      if (err instanceof ApiError && err.status === 401) {
        this.stop()
        return
      }
      this.scheduleReconnect()
      return
    }
    if (this.stopped) return

    const separator = ticket.url.includes("?") ? "&" : "?"
    const ws = new WebSocket(`${ticket.url}${separator}ticket=${encodeURIComponent(ticket.ticket)}`)
    this.ws = ws

    ws.onopen = () => {
      if (this.ws !== ws) return
      this.attempt = 0
      this.options.onStatus?.("open")
      if (this.subscriptions.size > 0) {
        this.send({ type: "subscribe", channel_ids: [...this.subscriptions] })
      }
    }
    ws.onmessage = (event) => {
      if (this.ws !== ws || typeof event.data !== "string") return
      try {
        this.options.onMessage(JSON.parse(event.data) as RealtimeMessage)
      } catch {
        // A frame we can't parse is a server bug; skip it.
      }
    }
    ws.onclose = (event) => {
      if (this.ws !== ws) return
      this.ws = null
      if (this.stopped) return
      this.options.onStatus?.("closed")
      // Lost access (e.g. suspended): reconnecting won't help.
      if (event.code === CLOSE_ACCESS_LOST) {
        this.stop()
        return
      }
      // 4401 just means the ticket was stale: retry right away with a new one.
      if (event.code === CLOSE_INVALID_TICKET && this.attempt === 0) {
        this.attempt++
        void this.connect()
        return
      }
      this.scheduleReconnect()
    }
  }

  // Exponential backoff with jitter (1 s, 2 s, 4 s... up to 30 s) so a
  // redeploy doesn't get every client knocking at the same instant.
  private scheduleReconnect() {
    if (this.stopped) return
    const base = Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** this.attempt)
    const delay = base / 2 + Math.random() * (base / 2)
    this.attempt++
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.connect()
    }, delay)
  }
}
