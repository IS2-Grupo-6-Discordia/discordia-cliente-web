import AsyncStorage from "@react-native-async-storage/async-storage"

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? ""

let token: string | null = null
let refreshToken: string | null = null

export async function loadToken() {
  token = await AsyncStorage.getItem("discordia_token")
  refreshToken = await AsyncStorage.getItem("discordia_refresh_token")
}

export function getToken() {
  return token
}

export async function setToken(t: string | null) {
  token = t
  if (t) await AsyncStorage.setItem("discordia_token", t)
  else await AsyncStorage.removeItem("discordia_token")
}

export function getRefreshToken() {
  return refreshToken
}

export async function setRefreshToken(t: string | null) {
  refreshToken = t
  if (t) await AsyncStorage.setItem("discordia_refresh_token", t)
  else await AsyncStorage.removeItem("discordia_refresh_token")
}

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown, message: string) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

function extractDetailMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : JSON.stringify(d))).join(" ")
  }
  return fallback
}

// Generic, user-safe messages per HTTP status (Spanish, Rioplatense).
const GENERIC_ERROR_BY_STATUS: Record<number, string> = {
  400: "Revisá los datos e intentá de nuevo.",
  422: "Revisá los datos e intentá de nuevo.",
  401: "Tu sesión expiró. Iniciá sesión de nuevo.",
  403: "No tenés permiso para hacer esto.",
  404: "No encontramos lo que buscabas.",
  429: "Hiciste muchos intentos seguidos. Esperá unos segundos y probá de nuevo.",
  408: "El servidor tardó demasiado en responder. Probá de nuevo.",
  504: "El servidor tardó demasiado en responder. Probá de nuevo.",
}

function genericForStatus(status: number): string {
  const known = GENERIC_ERROR_BY_STATUS[status]
  if (known) return known
  if (status >= 500) return "Algo salió mal en el servidor. Probá de nuevo en unos segundos."
  return "Ocurrió un error. Probá de nuevo."
}

// Heuristic guard: raw FastAPI/pydantic validation fragments (English) must
// never reach the user, even on the rare chance one arrives as a string detail.
function looksTechnical(msg: string): boolean {
  return /input should|invalid length|value is not|field required|ensure this|not a valid|expected length|value_error|type_error/i.test(
    msg,
  )
}

// Central mapping from any thrown error to a single, user-safe Spanish string.
// The raw error is logged for debugging but never surfaced verbatim to the UI.
export function friendlyError(err: unknown): string {
  // Keep the technical detail available for dev/debug without showing it.
  console.warn("[friendlyError]", err)

  if (err instanceof ApiError) {
    if (err.status === 429) return genericForStatus(429)
    // Business errors (401/403/404/409...) arrive as a human Spanish string in
    // `detail`; 422 validation errors arrive as an array/object, and 5xx are
    // never trustworthy for display -> fall back to a generic message.
    if (err.status < 500 && typeof err.detail === "string") {
      const detail = err.detail.trim()
      if (detail !== "" && !looksTechnical(detail)) {
        return detail
      }
    }
    return genericForStatus(err.status)
  }

  if (
    err instanceof TypeError ||
    (err instanceof Error &&
      (err.name === "AbortError" || /network|fetch|connect|timed? ?out/i.test(err.message)))
  ) {
    return "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo."
  }

  if (__DEV__) console.warn("[friendlyError] unexpected error:", err)

  return "Ocurrió un error inesperado. Probá de nuevo."
}

const NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/oauth/google",
  "/auth/refresh",
  "/auth/logout",
  "/auth/users",
])

let refreshing: Promise<boolean> | null = null

async function adoptStoredSession(staleToken: string): Promise<boolean> {
  const storedToken = await AsyncStorage.getItem("discordia_token")
  if (!storedToken || storedToken === staleToken) return false
  token = storedToken
  refreshToken = await AsyncStorage.getItem("discordia_refresh_token")
  return true
}

async function renewSession(staleToken: string): Promise<boolean> {
  if (await adoptStoredSession(staleToken)) return true
  if (!refreshToken) return false

  let res: Response
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch {
    return false
  }

  if (!res.ok) return adoptStoredSession(staleToken)

  const body = (await res.json()) as { access_token: string; refresh_token: string }
  await setToken(body.access_token)
  await setRefreshToken(body.refresh_token)
  return true
}

function refreshSession(staleToken: string): Promise<boolean> {
  if (!refreshing) {
    refreshing = renewSession(staleToken).finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function authorizedFetch(path: string, init: RequestInit): Promise<Response> {
  const send = () => {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
    if (token) headers["Authorization"] = `Bearer ${token}`
    return fetch(`${API_BASE}${path}`, { ...init, headers })
  }

  const sentToken = token
  let res = await send()

  if (res.status === 401 && sentToken && !NO_REFRESH_PATHS.has(path) && (await refreshSession(sentToken))) {
    res = await send()
  }

  if (res.status === 401) {
    await setToken(null)
    await setRefreshToken(null)
  }

  return res
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  const res = await authorizedFetch(path, { ...options, headers })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let detail: unknown = text
    try {
      detail = text ? JSON.parse(text).detail ?? text : "Error desconocido"
    } catch {
      detail = text || "Error desconocido"
    }
    if (__DEV__) console.warn(`[api] ${options.method ?? "GET"} ${path} -> ${res.status}`, text.slice(0, 200))
    throw new ApiError(res.status, detail, extractDetailMessage(detail, "Error desconocido"))
  }

  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// Multipart upload helper. Unlike `api()`, this does NOT set Content-Type so
// that fetch can add the multipart boundary itself; it only attaches the
// Authorization header when a token is present. `method` defaults to POST
// (create) but can be PATCH for partial multipart updates (e.g. banner edit).
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  method: string = "POST",
): Promise<T> {
  const res = await authorizedFetch(path, { method, body: formData, headers: {} })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let detail: unknown = text
    try {
      detail = text ? JSON.parse(text).detail ?? text : "Error desconocido"
    } catch {
      detail = text || "Error desconocido"
    }
    if (__DEV__) console.warn(`[apiUpload] ${method} ${path} -> ${res.status}`, text.slice(0, 200))
    throw new ApiError(res.status, detail, extractDetailMessage(detail, "Error desconocido"))
  }

  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
