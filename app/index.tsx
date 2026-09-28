import { Redirect } from "expo-router"
import { useAuth } from "@/context/AuthContext"

export default function Index() {
  const { isLoggedIn } = useAuth()

  if (isLoggedIn) {
    return <Redirect href="/(main)/chat" />
  }

  return <Redirect href="/(auth)/login" />
}
