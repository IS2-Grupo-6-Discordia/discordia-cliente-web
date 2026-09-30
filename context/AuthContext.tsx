import { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { ReactNode } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { User } from "@/api/types"
import { getToken, loadToken } from "@/api/client"
import { logout as apiLogout } from "@/api/auth"

interface AuthState {
  user: User | null
  isLoggedIn: boolean
  isLoading: boolean
  setUser: (user: User) => void
  logout: () => void
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
          const saved = await AsyncStorage.getItem("discordia_user")
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
    AsyncStorage.setItem("discordia_user", JSON.stringify(u))
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUserState(null)
    AsyncStorage.removeItem("discordia_user")
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}
