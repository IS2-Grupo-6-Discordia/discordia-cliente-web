import { Redirect } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import SessionSplash from "@/components/SessionSplash"

export default function Index() {
  const { isLoggedIn, isLoading } = useAuth()

  // Mientras se rehidrata la sesión no decidimos nada: mostrar el splash evita
  // redirigir al login por un frame antes de saber si hay token.
  if (isLoading) {
    return <SessionSplash />
  }

  if (isLoggedIn) {
    return <Redirect href="/(main)/chat" />
  }

  return <Redirect href="/(auth)/login" />
}
