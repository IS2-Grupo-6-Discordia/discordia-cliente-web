import { useState } from "react"
import { View, Text, Pressable, ActivityIndicator, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import PressableScale from "@/components/PressableScale"
import VoiceStage, { VOICE_LAYOUTS } from "@/components/VoiceStage"
import type { VoiceLayout } from "@/components/VoiceStage"
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
  const [layout, setLayout] = useState<VoiceLayout>("auto")
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)
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

      {connecting ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#8DA8AC", fontSize: 12.5 }}>Entrando a la sala...</Text>
        </View>
      ) : (
        <VoiceStage
          participants={participants}
          layout={layout}
          pinnedId={pinnedId}
          onTogglePin={(id) => setPinnedId((current) => (current === id ? null : id))}
        />
      )}

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
        <View style={{ alignItems: "center", gap: 7, width: isNarrow ? 76 : 88, opacity: connecting ? 0.5 : 1 }}>
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

        <View style={{ alignItems: "center", gap: 7, width: isNarrow ? 76 : 88, opacity: connecting ? 0.5 : 1 }}>
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

        <View style={{ alignItems: "center", gap: 7, width: isNarrow ? 76 : 88, opacity: connecting ? 0.5 : 1 }}>
          <PressableScale
            onPress={() => setLayoutMenuOpen((open) => !open)}
            disabled={connecting}
            accessibilityLabel="Cambiar diseño"
            pressedScale={0.9}
            hoverStyle={{ backgroundColor: "rgba(255,255,255,0.16)" }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: layoutMenuOpen ? "rgba(55,214,192,0.20)" : "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: layoutMenuOpen ? "rgba(55,214,192,0.50)" : "rgba(255,255,255,0.14)",
            }}
          >
            <Ionicons name="grid-outline" size={21} color="#E6F3F3" />
          </PressableScale>
          <Text style={{ color: "#C9DADC", fontWeight: "700", fontSize: 10 }}>Diseño</Text>
        </View>

        <View style={{ alignItems: "center", gap: 7, width: isNarrow ? 76 : 88 }}>
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

      {layoutMenuOpen ? (
        <>
          <Pressable
            onPress={() => setLayoutMenuOpen(false)}
            accessibilityLabel="Cerrar menú de diseño"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 108,
              alignSelf: "center",
              width: 240,
              padding: 6,
              borderRadius: 14,
              backgroundColor: "#12222E",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Text style={{ color: "#8DA8AC", fontSize: 11, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 8 }}>
              Cambiar diseño
            </Text>
            {VOICE_LAYOUTS.map((option) => {
              const selected = option.value === layout
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setLayout(option.value)
                    setLayoutMenuOpen(false)
                  }}
                  accessibilityLabel={`Diseño ${option.label}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: selected ? "rgba(55,214,192,0.14)" : "transparent",
                  }}
                >
                  <Ionicons name={option.icon} size={17} color={selected ? "#37D6C0" : "#C9DADC"} />
                  <Text style={{ flex: 1, color: selected ? "#37D6C0" : "#E6F3F3", fontSize: 13, fontWeight: "600" }}>
                    {option.label}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={16} color="#37D6C0" /> : null}
                </Pressable>
              )
            })}
          </View>
        </>
      ) : null}
    </View>
  )
}
