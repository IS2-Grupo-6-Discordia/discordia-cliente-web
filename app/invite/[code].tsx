import { useEffect, useRef, useState } from "react"
import { View, Text } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { joinServer } from "@/api/servers"
import { ApiError } from "@/api/client"
import { HOME_ROUTE } from "@/lib/safeRedirect"
import SessionSplash from "@/components/SessionSplash"
import PressableScale from "@/components/PressableScale"

// Deep-link landing for invitation URLs: "<origin>/invite/<code>" (the same
// shape the share link already uses). It sits at the app root, OUTSIDE the
// (auth) and (main) groups, so it inherits no session guard and must check auth
// itself. Flow:
//   - rehydrating session       -> splash
//   - logged out                -> login, remembering this invite as redirect
//   - logged in + valid code    -> join, then open the server in chat
//   - errors (404/403/410/...)  -> a clear message with a way back
function messageForError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "Esta invitación no existe o ya no es válida."
    if (err.status === 403) return "Estás baneado de este servidor."
    if (err.status === 410) return "Esta invitación expiró o alcanzó su límite de usos."
  }
  return "No pudimos procesar la invitación. Probá de nuevo en un rato."
}

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const router = useRouter()
  const { isLoggedIn, isLoading } = useAuth()

  const inviteCode = typeof code === "string" ? code.trim() : ""

  // `startedRef` dedupes the network call across React StrictMode's double
  // mount (refs persist across the simulated unmount/remount), so we join only
  // once. We deliberately keep navigation out of the join effect's cleanup: the
  // resolved server id lands in state and a separate effect navigates on the
  // live instance, avoiding the StrictMode "stale active flag" trap.
  const startedRef = useRef(false)
  const [targetServerId, setTargetServerId] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (isLoading || !isLoggedIn || inviteCode === "") return
    if (startedRef.current) return
    startedRef.current = true

    joinServer(inviteCode)
      .then(({ server }) => setTargetServerId(server.id))
      .catch((err) => {
        // Let a fresh mount retry after a transient failure.
        startedRef.current = false
        setError(messageForError(err))
      })
  }, [isLoading, isLoggedIn, inviteCode])

  useEffect(() => {
    if (!targetServerId) return
    router.replace({ pathname: "/(main)/chat", params: { serverId: targetServerId } })
  }, [targetServerId, router])

  // Session still rehydrating: don't decide anything yet.
  if (isLoading) return <SessionSplash message="Validando tu invitación..." />

  // Logged out: go to login and come back to this invite once authenticated.
  if (!isLoggedIn) {
    if (inviteCode === "") return <Redirect href="/(auth)/login" />
    return (
      <Redirect
        href={{ pathname: "/(auth)/login", params: { redirect: `/invite/${inviteCode}` } }}
      />
    )
  }

  if (inviteCode === "" || error) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A1620", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View
          style={{
            width: "100%",
            maxWidth: 360,
            alignItems: "center",
            gap: 12,
            borderRadius: 16,
            padding: 24,
            backgroundColor: "rgba(255,255,255,0.055)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.13)",
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,127,114,0.12)",
            }}
          >
            <Ionicons name="link-outline" size={26} color="#FF7F72" />
          </View>
          <Text style={{ color: "#F2FAFA", fontSize: 16, fontWeight: "800", textAlign: "center" }}>
            {inviteCode === "" ? "Link de invitación inválido" : "No pudimos unirte"}
          </Text>
          <Text style={{ color: "#8DA8AC", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
            {inviteCode === ""
              ? "El link no tiene un código de invitación. Pedile a quien te invitó que te lo comparta de nuevo."
              : error}
          </Text>
          <PressableScale
            onPress={() => router.replace(HOME_ROUTE)}
            style={{
              marginTop: 4,
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 20,
              backgroundColor: "#37D6C0",
            }}
          >
            <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>Ir a Discordia</Text>
          </PressableScale>
        </View>
      </View>
    )
  }

  // Logged in, valid code, join in flight.
  return <SessionSplash message="Uniéndote al servidor..." />
}
