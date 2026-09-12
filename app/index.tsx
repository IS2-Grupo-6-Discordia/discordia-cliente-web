import { Redirect } from "expo-router"
import { View, ActivityIndicator } from "react-native"
import { useAuth } from "@/context/AuthContext"

export default function Index() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A1620", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#37D6C0" />
      </View>
    )
  }

  if (isLoggedIn) {
    return <Redirect href="/(main)/chat" />
  }

  return <Redirect href="/(auth)/login" />
}
