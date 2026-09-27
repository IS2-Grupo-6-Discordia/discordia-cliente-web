import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"
import type { User } from "@/api/types"
import { getToken } from "@/api/client"
import { logout as apiLogout } from "@/api/auth"

interface AuthState {
  user: User | null
  isLoggedIn: boolean
  setUser: (user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    // Si hay token guardado, restauramos la sesión con datos mínimos.
    // Cuando el backend esté listo, acá se haría un GET /auth/me.
    const token = getToken()
    if (token) {
      const saved = localStorage.getItem("discordia_user")
      return saved ? JSON.parse(saved) : null
    }
    return null
  })

  const setUser = useCallback((u: User) => {
    setUserState(u)
    localStorage.setItem("discordia_user", JSON.stringify(u))
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUserState(null)
    localStorage.removeItem("discordia_user")
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}
