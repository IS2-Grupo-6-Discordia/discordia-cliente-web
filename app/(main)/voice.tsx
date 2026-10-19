import { View, Text, ScrollView, Platform, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import Avatar from "@/components/Avatar"
import PressableScale from "@/components/PressableScale"
import { useVoice } from "@/context/VoiceContext"

// HU-17: the call the user joined from the channel list. Joining happens there
// (confirmation + permission checks); this tab shows who is in the room and
// lets the user hang up. Mic toggles (HU-19) are not wired yet.
export default function VoiceScreen() {
  const router = useRouter()
  const voice = useVoice()
  const { channel, status, participants } = voice

  if (status === "idle" || !channel) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A1620", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 9999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(55,214,192,0.12)",
            borderWidth: 1,
            borderColor: "rgba(55,214,192,0.30)",
            marginBottom: 18,
          }}
        >
          <Ionicons name="headset-outline" size={28} color="#37D6C0" />
        </View>
        <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 16, letterSpacing: -0.2 }}>
          No estás en ningún canal de voz
        </Text>
        <Text style={{ color: "#8DA8AC", fontSize: 12.5, lineHeight: 18, marginTop: 6, textAlign: "center", maxWidth: 320 }}>
          {voice.dropNotice || "Elegí un canal de voz en la lista de canales de un servidor para unirte."}
        </Text>
        <PressableScale
          onPress={() => router.push("/(main)/chat")}
          hoverStyle={{ backgroundColor: "#2BC4AF" }}
          style={{ marginTop: 20, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20, backgroundColor: "#37D6C0" }}
        >
          <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>Ver canales</Text>
        </PressableScale>
      </View>
    )
  }

  const connecting = status === "connecting"

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1620" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 20,
          height: 52,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.10)",
          backgroundColor: "rgba(255,255,255,0.03)",
        }}
      >
        <Ionicons name="volume-high" size={17} color={connecting ? "#F0C24B" : "#4FD69C"} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 13.5 }} numberOfLines={1}>
            {channel.name}
          </Text>
          <Text style={{ color: "#8DA8AC", fontSize: 10 }} numberOfLines={1}>
            {channel.serverName}
            {connecting ? "" : ` / ${participants.length} ${participants.length === 1 ? "conectado" : "conectados"}`}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 9999,
            backgroundColor: connecting ? "rgba(240,194,75,0.14)" : "rgba(79,214,156,0.14)",
          }}
        >
          {connecting ? (
            <ActivityIndicator size="small" color="#F0C24B" style={{ transform: [{ scale: 0.7 }] }} />
          ) : (
            <View style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: "#4FD69C" }} />
          )}
          <Text style={{ color: connecting ? "#F0C24B" : "#4FD69C", fontWeight: "700", fontSize: 11 }}>
            {connecting ? "Conectando" : "Conectado"}
          </Text>
        </View>
      </View>

      {/* Participant grid */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        {connecting ? (
          <Text style={{ color: "#8DA8AC", fontSize: 12.5 }}>Entrando a la sala...</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, maxWidth: 700 }}>
            {participants.map((p) => (
              <View
                key={p.id}
                style={{
                  alignItems: "center",
                  paddingVertical: 28,
                  paddingHorizontal: 24,
                  width: "47%",
                  minWidth: 200,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: p.isLocal ? "rgba(55,214,192,0.35)" : "rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  ...(Platform.OS === "web"
                    ? ({ transitionProperty: "border-color, background-color", transitionDuration: "180ms" } as object)
                    : {}),
                }}
              >
                {/* Avatar + mic-off badge */}
                <View style={{ position: "relative" }}>
                  <View style={{ borderRadius: 9999, padding: 3 }}>
                    <Avatar initials={p.avatar} uri={p.avatarUrl} size={68} />
                  </View>
                  {!p.micEnabled ? (
                    <View
                      style={{
                        position: "absolute",
                        right: -2,
                        bottom: 0,
                        width: 26,
                        height: 26,
                        borderRadius: 9999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#FF7F72",
                        borderWidth: 3,
                        borderColor: "#0A1620",
                      }}
                    >
                      <Ionicons name="mic-off" size={12} color="#04211D" />
                    </View>
                  ) : null}
                </View>

                <Text style={{ color: "#E6F3F3", fontWeight: "700", marginTop: 14, fontSize: 14 }} numberOfLines={1}>
                  {p.name}
                  {p.isLocal ? <Text style={{ color: "#8DA8AC", fontWeight: "500" }}> (vos)</Text> : null}
                </Text>
                <Text style={{ fontSize: 11, marginTop: 3, color: "#8DA8AC" }}>
                  {p.micEnabled ? "En la sala" : "Sin micrófono"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Control bar */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.10)",
          backgroundColor: "rgba(255,255,255,0.03)",
        }}
      >
        <View style={{ alignItems: "center", gap: 7, width: 88 }}>
          <PressableScale
            onPress={() => voice.leave()}
            accessibilityLabel="Desconectarse del canal de voz"
            pressedScale={0.9}
            hoverStyle={{ backgroundColor: "#FF6B5C" }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FF7F72",
            }}
          >
            <Ionicons name="call" size={22} color="#04211D" style={{ transform: [{ rotate: "135deg" }] }} />
          </PressableScale>
          <Text style={{ color: "#FF7F72", fontWeight: "700", fontSize: 10 }}>Desconectar</Text>
        </View>
      </View>
    </View>
  )
}
