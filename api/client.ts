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

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    await setToken(null)
    await setRefreshToken(null)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let detail: unknown = text
    try {
      detail = text ? JSON.parse(text).detail ?? text : "Error desconocido"
    } catch {
      detail = text || "Error desconocido"
    }
    throw new ApiError(res.status, detail, extractDetailMessage(detail, "Error desconocido"))
  }

  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
