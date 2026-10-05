import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import type { ReactNode } from "react"
import type { User } from "@/api/types"
import { Platform } from "react-native"
import { ApiError, getToken, loadToken } from "@/api/client"
import { getMe, logout as apiLogout } from "@/api/auth"

const ACCOUNT_CHECK_INTERVAL_MS = 60_000

export type SignedOutReason = "suspended" | "expired"

interface AuthState {
  user: User | null
  isLoggedIn: boolean
  isLoading: boolean
  setUser: (user: User) => void
  logout: () => void
  signedOutReason: SignedOutReason | null
  clearSignedOutReason: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Arrancamos sin sesión y "hidratando": getToken() es null hasta que loadToken()
  // corra, así que NO decidimos la sesión en el initializer sync. La sesión real
  // se restaura en el useEffect de abajo.
  const [user, setUserState] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Rehidratación al montar: loadToken() trae el token de AsyncStorage a memoria
  // y, si hay token, restauramos el user cacheado (discordia_user). Recién ahí
  // bajamos isLoading para que el guard decida sin la race de redirigir por un
  // frame antes de que el storage termine de leerse.
  useEffect(() => {
    let active = true
    ;(async () => {
      await loadToken()
      if (!active) return
      if (getToken()) {
        try {
          const saved = localStorage.getItem("discordia_user")
          if (saved) setUserState(JSON.parse(saved))
        } catch {
          // Storage ilegible: seguimos sin user y el guard mandará al login.
        }
      }
      setIsLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const setUser = useCallback((u: User) => {
    setUserState(u)
    localStorage.setItem("discordia_user", JSON.stringify(u))
  }, [])

  const [signedOutReason, setSignedOutReason] = useState<SignedOutReason | null>(null)
  const checking = useRef(false)

  const logout = useCallback(() => {
    apiLogout()
    setUserState(null)
    localStorage.removeItem("discordia_user")
  }, [])

  const signOutWithReason = useCallback(
    (reason: SignedOutReason) => {
      setSignedOutReason(reason)
      logout()
    },
    [logout],
  )

  const clearSignedOutReason = useCallback(() => setSignedOutReason(null), [])

  const isLoggedIn = !!user

  useEffect(() => {
    if (!isLoggedIn) return
    let active = true

    const checkAccount = async () => {
      if (checking.current || !getToken()) return
      checking.current = true
      try {
        const fresh = await getMe()
        if (active) setUser(fresh)
      } catch (err) {
        if (!active || !(err instanceof ApiError)) return
        if (err.status === 404) signOutWithReason("suspended")
        else if (err.status === 401) signOutWithReason("expired")
      } finally {
        checking.current = false
      }
    }

    const interval = setInterval(checkAccount, ACCOUNT_CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") checkAccount()
    }
    if (Platform.OS === "web") document.addEventListener("visibilitychange", onVisible)

    return () => {
      active = false
      clearInterval(interval)
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", onVisible)
    }
  }, [isLoggedIn, setUser, signOutWithReason])

  return (
    <AuthContext.Provider
      value={{ user, isLoggedIn, isLoading, setUser, logout, signedOutReason, clearSignedOutReason }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}
