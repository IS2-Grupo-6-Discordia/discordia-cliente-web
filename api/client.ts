import AsyncStorage from "@react-native-async-storage/async-storage"

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? ""

let token: string | null = null

export async function loadToken() {
  token = await AsyncStorage.getItem("discordia_token")
}

export function getToken() {
  return token
}

export async function setToken(t: string | null) {
  token = t
  if (t) await AsyncStorage.setItem("discordia_token", t)
  else await AsyncStorage.removeItem("discordia_token")
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
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "Error desconocido")
    throw new Error(body)
  }

  return res.json()
}
