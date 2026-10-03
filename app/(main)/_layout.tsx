import { Tabs, useRouter, Redirect } from "expo-router"
import { View, Text, TouchableOpacity, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import UserMenu from "@/components/UserMenu"
import SessionSplash from "@/components/SessionSplash"

// Maps each tab to a filled/outline Ionicons pair so the bar reads as real
// navigation (the default had no icons, which rendered as confusing ▼ glyphs).
type IoniconName = React.ComponentProps<typeof Ionicons>["name"]
function tabIcon(active: IoniconName, inactive: IoniconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  )
}

export default function MainLayout() {
  const { isLoggedIn, isLoading } = useAuth()
  const router = useRouter()

  // Al recargar una ruta protegida (p. ej. /(main)/chat) este layout corre antes
  // que index.tsx, así que también hay que esperar la rehidratación acá: si no,
  // isLoggedIn es false por un frame y rebota al login aunque haya token.
  if (isLoading) {
    return <SessionSplash />
  }

  // Session guard: as soon as the session is cleared (logout button, 401 auto-logout,
  // etc.) we bounce out of the protected group back to login.
  if (!isLoggedIn) {
    return <Redirect href="/(auth)/login" />
  }

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
          <TouchableOpacity
            onPress={() => router.push("/(main)/chat")}
            accessibilityLabel="Ir al inicio"
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                backgroundColor: "#37D6C0",
                alignItems: "center",
                justifyContent: "center",
                ...(Platform.OS === "web"
                  ? ({ boxShadow: "0 4px 16px -2px rgba(55,214,192,0.65)" } as object)
                  : {}),
              }}
            >
              <Text style={{ color: "#04211D", fontWeight: "900", fontSize: 14 }}>D</Text>
            </View>
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 15 }}>Discordia</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <View style={{ marginRight: 12 }}>
            <UserMenu />
          </View>
        ),
        tabBarStyle: {
          backgroundColor: "#0A1620",
          borderTopColor: "rgba(255,255,255,0.13)",
          borderTopWidth: 1,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
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
        options={{
          title: "Chat",
          tabBarLabel: "Chat",
          tabBarIcon: tabIcon("chatbubble-ellipses", "chatbubble-ellipses-outline"),
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: "Voz",
          tabBarLabel: "Voz",
          tabBarIcon: tabIcon("headset", "headset-outline"),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Servidor",
          tabBarLabel: "Servidor",
          tabBarIcon: tabIcon("settings", "settings-outline"),
        }}
      />
      <Tabs.Screen
        name="backoffice"
        options={{
          title: "Backoffice",
          tabBarLabel: "Backoffice",
          tabBarIcon: tabIcon("shield-checkmark", "shield-checkmark-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, title: "Perfil" }}
      />
      <Tabs.Screen
        name="users/[id]"
        options={{ href: null, title: "Perfil" }}
      />
    </Tabs>
  )
}
