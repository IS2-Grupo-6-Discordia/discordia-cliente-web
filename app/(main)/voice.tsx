import { useState } from "react"
import { View, Text, ScrollView, Platform, ActivityIndicator, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import Avatar from "@/components/Avatar"
import PressableScale from "@/components/PressableScale"
import VoiceVideoTile from "@/components/VoiceVideoTile"
import { useVoice } from "@/context/VoiceContext"

// HU-19: a plain mic while transmitting; muted, the same mic crossed by a red
// diagonal line (drawn over the icon, since Ionicons' mic-off is single-color).
function MicIcon({ muted, size, color }: { muted: boolean; size: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="mic" size={size} color={color} />
      {muted ? (
        <View
          style={{
            position: "absolute",
            width: size * 1.25,
            height: 3,
            borderRadius: 2,
            backgroundColor: "#FF4D4D",
            transform: [{ rotate: "-45deg" }],
          }}
        />
      ) : null}
    </View>
  )
}

// HU-17: the call the user joined from the channel list. Joining happens there
// (confirmation + permission checks); this tab shows who is in the room and
// lets the user mute (HU-19) or hang up.
export default function VoiceScreen() {
  const router = useRouter()
  const voice = useVoice()
  const { channel, status, participants } = voice
  const [micError, setMicError] = useState("")
  // Phones: two smaller cards per row instead of one wide card each.
  const isNarrow = useWindowDimensions().width < 600

  const handleToggleMic = async () => {
    setMicError("")
    try {
      await voice.toggleMic()
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "No pudimos cambiar el estado de tu micrófono.")
    }
  }

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
          paddingHorizontal: isNarrow ? 14 : 20,
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
          padding: isNarrow ? 12 : 20,
        }}
      >
        {connecting ? (
          <Text style={{ color: "#8DA8AC", fontSize: 12.5 }}>Entrando a la sala...</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: isNarrow ? 10 : 16, maxWidth: 700, width: "100%" }}>
            {participants.map((p) => (
              <View
                key={p.id}
                style={{
                  alignItems: "center",
                  overflow: "hidden",
                  width: "47%",
                  minWidth: isNarrow ? 130 : 200,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: p.isLocal ? "rgba(55,214,192,0.35)" : "rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  ...(Platform.OS === "web"
                    ? ({ transitionProperty: "border-color, background-color", transitionDuration: "180ms" } as object)
                    : {}),
                }}
              >
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 16 / 9,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.22)",
                  }}
                >
                  {p.camEnabled && p.videoTrack ? (
                    <VoiceVideoTile track={p.videoTrack} mirrored={p.isLocal} />
                  ) : (
                    <Avatar initials={p.avatar} uri={p.avatarUrl} size={isNarrow ? 52 : 68} />
                  )}
                  {!p.micEnabled ? (
                    <View
                      style={{
                        position: "absolute",
                        right: 8,
                        bottom: 8,
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

                <View style={{ width: "100%", alignItems: "center", paddingHorizontal: 10, paddingVertical: 10 }}>
                  <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
                    {p.name}
                    {p.isLocal ? <Text style={{ color: "#8DA8AC", fontWeight: "500" }}> (vos)</Text> : null}
                  </Text>
                  <Text style={{ fontSize: 11, marginTop: 3, color: "#8DA8AC" }}>
                    {p.micEnabled ? "En la sala" : "Silenciado"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {micError || voice.cameraError ? (
        <Text style={{ color: "#FF9E94", fontSize: 12, textAlign: "center", paddingHorizontal: 20, paddingBottom: 8 }}>
          {micError || voice.cameraError}
        </Text>
      ) : null}

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
        {/* HU-19: mute toggle */}
        <View style={{ alignItems: "center", gap: 7, width: 88, opacity: connecting ? 0.5 : 1 }}>
          <PressableScale
            onPress={handleToggleMic}
            disabled={connecting}
            accessibilityLabel={voice.micEnabled ? "Silenciar micrófono" : "Activar micrófono"}
            pressedScale={0.9}
            hoverStyle={{ backgroundColor: "rgba(255,255,255,0.16)" }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
            }}
          >
            <MicIcon muted={!voice.micEnabled} size={22} color="#E6F3F3" />
          </PressableScale>
          <Text style={{ color: "#C9DADC", fontWeight: "700", fontSize: 10 }}>
            {voice.micEnabled ? "Silenciar" : "Activar"}
          </Text>
        </View>

        <View style={{ alignItems: "center", gap: 7, width: 88, opacity: connecting ? 0.5 : 1 }}>
          <PressableScale
            onPress={() => voice.toggleCamera()}
            disabled={connecting}
            accessibilityLabel={voice.camEnabled ? "Apagar cámara" : "Activar cámara"}
            pressedScale={0.9}
            hoverStyle={{ backgroundColor: "rgba(255,255,255,0.16)" }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: voice.camEnabled ? "rgba(55,214,192,0.20)" : "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: voice.camEnabled ? "rgba(55,214,192,0.50)" : "rgba(255,255,255,0.14)",
            }}
          >
            <Ionicons name={voice.camEnabled ? "videocam" : "videocam-off"} size={22} color="#E6F3F3" />
          </PressableScale>
          <Text style={{ color: "#C9DADC", fontWeight: "700", fontSize: 10 }}>
            {voice.camEnabled ? "Apagar" : "Activar cámara"}
          </Text>
        </View>

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
