import { api, setToken } from "./client"
import type { AuthResponse } from "./types"

const USE_MOCK = !process.env.EXPO_PUBLIC_API_URL

function mockDelay(ms = 800) {
  return new Promise((r) => setTimeout(r, ms))
}

const MOCK_USER = {
  id: "4",
  name: "Facundo",
  email: "facundo@ejemplo.com",
  avatar: "FA",
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay(1400)
    if (password === "error") {
      throw new Error("Email o contraseña incorrectos.")
    }
    const token = "mock-jwt-token-" + Date.now()
    await setToken(token)
    return { token, user: MOCK_USER }
  }

  const res = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  await setToken(res.token)
  return res
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay(1200)
    if (email === "duplicado@ejemplo.com") {
      throw new Error("EMAIL_DUPLICADO")
    }
    const token = "mock-jwt-token-" + Date.now()
    await setToken(token)
    return { token, user: { ...MOCK_USER, name, email } }
  }

  const res = await api<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  })
  await setToken(res.token)
  return res
}

export async function requestRecovery(email: string): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(1000)
    return
  }

  await api("/auth/recovery", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function logout() {
  await setToken(null)
}
