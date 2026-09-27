import { Tabs } from "expo-router"
import { View, Text, TouchableOpacity } from "react-native"
import { useAuth } from "@/context/AuthContext"

export default function MainLayout() {
  const { user, logout } = useAuth()

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "rgba(255,255,255,0.055)",
          borderBottomColor: "rgba(255,255,255,0.13)",
          borderBottomWidth: 1,
        } as any,
        headerTintColor: "#E6F3F3",
        headerTitle: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 24, height: 24, borderRadius: 9999, backgroundColor: "#37D6C0", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#04211D", fontWeight: "900", fontSize: 12 }}>D</Text>
            </View>
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 14 }}>Discordia</Text>
          </View>
        ),
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: 12 }}>
            <Text style={{ color: "#8DA8AC", fontSize: 12 }}>{user?.name}</Text>
            <TouchableOpacity
              onPress={logout}
              style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}
            >
              <Text style={{ color: "#8DA8AC", fontSize: 10 }}>Salir</Text>
            </TouchableOpacity>
          </View>
        ),
        tabBarStyle: {
          backgroundColor: "#0A1620",
          borderTopColor: "rgba(255,255,255,0.13)",
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: "#37D6C0",
        tabBarInactiveTintColor: "#8DA8AC",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        sceneStyle: { backgroundColor: "#0A1620" },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{ title: "Chat", tabBarLabel: "Chat" }}
      />
      <Tabs.Screen
        name="voice"
        options={{ title: "Voz", tabBarLabel: "Voz" }}
      />
      <Tabs.Screen
        name="admin"
        options={{ title: "Servidor", tabBarLabel: "Servidor" }}
      />
      <Tabs.Screen
        name="backoffice"
        options={{ title: "Backoffice", tabBarLabel: "Backoffice" }}
      />
    </Tabs>
  )
}
