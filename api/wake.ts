import { useEffect, useState } from "react"

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? ""
const RENDER_DEFAULT_WAKE_URLS = [
  "https://microservicio-autenticacion-z127.onrender.com/health",
  "https://microservicio-servidores.onrender.com/readyz",
]
const WAKE_TIMEOUT_MS = 120_000
const ATTEMPT_TIMEOUT_MS = 30_000
const RETRY_DELAY_MS = 2_000
const AWAKE_GRACE_MS = 5 * 60_000

export type WakeState = "idle" | "waking" | "ready" | "failed"

function wakeUrls(): string[] {
  const configured = process.env.EXPO_PUBLIC_WAKE_URLS
  if (configured !== undefined) {
    return configured
      .split(",")
      .map((url: string) => url.trim())
      .filter(Boolean)
  }
  return API_BASE.includes(".onrender.com") ? RENDER_DEFAULT_WAKE_URLS : []
}

let state: WakeState = "idle"
let pending: Promise<WakeState> | null = null
let lastReadyAt = 0
const listeners = new Set<(s: WakeState) => void>()

function setState(next: WakeState) {
  state = next
  listeners.forEach((listener) => listener(next))
}

async function attempt(url: string): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS)
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function ping(url: string): Promise<void> {
  const deadline = Date.now() + WAKE_TIMEOUT_MS
  for (;;) {
    try {
      await attempt(url)
      return
    } catch (err) {
      if (Date.now() + RETRY_DELAY_MS >= deadline) throw err
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
}

export function wakeBackends(): Promise<WakeState> {
  const urls = wakeUrls()
  if (urls.length === 0) {
    setState("ready")
    return Promise.resolve("ready")
  }
  if (state === "ready" && Date.now() - lastReadyAt < AWAKE_GRACE_MS) return Promise.resolve("ready")
  if (pending) return pending

  setState("waking")
  pending = Promise.all(urls.map(ping))
    .then(() => {
      lastReadyAt = Date.now()
      setState("ready")
      return "ready" as const
    })
    .catch(() => {
      setState("failed")
      return "failed" as const
    })
    .finally(() => {
      pending = null
    })
  return pending
}

export function useWakeState(): WakeState {
  const [current, setCurrent] = useState<WakeState>(state)
  useEffect(() => {
    listeners.add(setCurrent)
    setCurrent(state)
    return () => {
      listeners.delete(setCurrent)
    }
  }, [])
  return current
}
