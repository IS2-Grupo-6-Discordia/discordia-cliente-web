// Pre-warms the backend chain so the first real request doesn't pay the cold-start cost.
//
// Why this exists: the microservices run on Render's free tier (they spin down when idle)
// and the KrakenD gateway has a short global timeout (3000ms). The first request after an
// idle period wakes the service + opens the DB connection, which can exceed that timeout and
// surface as a 500. Pinging the endpoints here ahead of time keeps everything warm.
//
// It is best-effort: it never fails the process (always exits 0), so it can safely run as a
// `preweb`/`prestart` hook without blocking `npm run web` when something is down.
//
// It CANNOT un-pause a paused Supabase project (that needs a manual restore from the
// dashboard). It only helps with cold starts and idle DB connections.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

const REQUEST_TIMEOUT_MS = 60_000 // generous: a cold Render service can take ~30-50s to wake
const RETRIES = 2

/** Read EXPO_PUBLIC_API_URL from the environment, falling back to parsing the local .env file. */
function resolveBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.trim()
  try {
    const env = readFileSync(join(__dirname, "..", ".env"), "utf8")
    const match = env.match(/^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$/m)
    if (match) return match[1].trim().replace(/^["']|["']$/g, "")
  } catch {
    // no .env file: nothing to warm against
  }
  return ""
}

function timed(fetchPromise) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return { signal: controller.signal, done: () => clearTimeout(timer) }
}

/**
 * Ping one target, retrying on network/timeout errors. Any HTTP status counts as "awake":
 * we only care that the service responded, not that the call succeeded (a 401/422 still means
 * the service and its DB path are warm).
 */
async function ping({ label, url, method = "GET", body }) {
  const start = Date.now()
  for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
    const { signal, done } = timed()
    try {
      const res = await fetch(url, {
        method,
        signal,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      })
      done()
      const ms = Date.now() - start
      console.log(`  ✓ ${label.padEnd(22)} HTTP ${res.status} (${ms}ms)`)
      return true
    } catch (err) {
      done()
      if (attempt <= RETRIES) continue
      const ms = Date.now() - start
      const reason = err?.name === "AbortError" ? "timeout" : (err?.message ?? "error")
      console.log(`  ✗ ${label.padEnd(22)} ${reason} (${ms}ms)`)
      return false
    }
  }
  return false
}

async function main() {
  const base = resolveBaseUrl().replace(/\/+$/, "")
  if (!base) {
    console.log("[warmup] EXPO_PUBLIC_API_URL no está seteada (modo mock): nada que precalentar.")
    return
  }

  console.log(`[warmup] Precalentando el backend en ${base} ...`)

  // Warms gateway + auth service (no DB) and gateway + auth + DB (login touches the database;
  // a wrong-password login returns 401, which is exactly the DB path we want warm).
  const targets = [
    { label: "gateway + jwks", url: `${base}/auth/.well-known/jwks.json` },
    {
      label: "auth + db (login)",
      url: `${base}/auth/login`,
      method: "POST",
      body: JSON.stringify({ email: "warmup@gmail.com", password: "warmup-not-a-real-pw" }),
    },
  ]

  // The servidores microservice is behind the gateway's JWT gate, so it can't be warmed through
  // the gateway without a token. We hit its Render URL directly instead: /readyz runs a
  // `SELECT 1`, so it wakes both the process and the DB connection. Override with SERVERS_READYZ_URL.
  const serversReadyz =
    process.env.SERVERS_READYZ_URL ?? "https://microservicio-servidores.onrender.com/readyz"
  if (serversReadyz) targets.push({ label: "servidores + db", url: serversReadyz })

  // Extra targets (e.g. the servidores microservice /health direct URL) can be added without
  // touching this file: WARMUP_EXTRA_URLS="https://host-a/health,https://host-b/health".
  const extra = (process.env.WARMUP_EXTRA_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
  for (const url of extra) targets.push({ label: "extra", url })

  await Promise.all(targets.map(ping))
  console.log("[warmup] Listo.")
}

main().catch((err) => {
  // Best-effort: never block the app from starting because warming failed.
  console.log(`[warmup] Se omitió por un error inesperado: ${err?.message ?? err}`)
})
