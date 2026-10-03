import { useState } from "react"
import { View, Text, ScrollView, Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import Avatar from "@/components/Avatar"
import PressableScale from "@/components/PressableScale"

const PARTICIPANTS = [
  { id: "1", name: "Facundo", avatar: "FA", speaking: true, muted: false },
  { id: "2", name: "Mora B.", avatar: "MB", speaking: false, muted: false },
  { id: "3", name: "Juanpi", avatar: "JP", speaking: false, muted: true },
  { id: "4", name: "Lucía R.", avatar: "LR", speaking: false, muted: false },
]

type IconName = React.ComponentProps<typeof Ionicons>["name"]

export default function VoiceScreen() {
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [sharing, setSharing] = useState(false)

  const controls: {
    key: string
    icon: IconName
    label: string
    active: boolean
    activeColor: string
    toggle: () => void
  }[] = [
    {
      key: "mic",
      icon: muted ? "mic-off" : "mic",
      label: muted ? "Activar mic" : "Silenciar",
      active: muted,
      activeColor: "#FF7F72",
      toggle: () => setMuted((m) => !m),
    },
    {
      key: "audio",
      icon: deafened ? "volume-mute" : "volume-high",
      label: deafened ? "Activar audio" : "Ensordecer",
      active: deafened,
      activeColor: "#FF7F72",
      toggle: () => setDeafened((d) => !d),
    },
    {
      key: "screen",
      icon: sharing ? "stop-circle" : "desktop-outline",
      label: sharing ? "Detener" : "Pantalla",
      active: sharing,
      activeColor: "#37D6C0",
      toggle: () => setSharing((s) => !s),
    },
  ]

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
        <Ionicons name="headset" size={17} color="#4FD69C" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 13.5 }}>Sala 1</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 10 }}>FIUBA · IS2 · {PARTICIPANTS.length} conectados</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 9999,
            backgroundColor: "rgba(79,214,156,0.14)",
          }}
        >
          <View style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: "#4FD69C" }} />
          <Text style={{ color: "#4FD69C", fontWeight: "700", fontSize: 11 }}>Conectado</Text>
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, maxWidth: 700 }}>
          {PARTICIPANTS.map((p) => (
            <View
              key={p.id}
              style={{
                alignItems: "center",
                paddingVertical: 28,
                paddingHorizontal: 24,
                width: "47%",
                minWidth: 200,
                backgroundColor: p.speaking ? "rgba(79,214,156,0.06)" : "rgba(255,255,255,0.04)",
                borderWidth: 1,
                borderColor: p.speaking ? "#4FD69C" : "rgba(255,255,255,0.10)",
                borderRadius: 14,
                ...(Platform.OS === "web"
                  ? ({
                      transitionProperty: "border-color, background-color",
                      transitionDuration: "180ms",
                    } as object)
                  : {}),
              }}
            >
              {/* Avatar with a speaking ring + mic-off badge */}
              <View style={{ position: "relative" }}>
                <View
                  style={{
                    borderRadius: 9999,
                    padding: 3,
                    borderWidth: 2,
                    borderColor: p.speaking ? "#4FD69C" : "transparent",
                    ...(p.speaking && Platform.OS === "web"
                      ? ({ boxShadow: "0 0 0 4px rgba(79,214,156,0.18)" } as object)
                      : {}),
                  }}
                >
                  <Avatar initials={p.avatar} size={68} />
                </View>
                {p.muted ? (
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

              <Text style={{ color: "#E6F3F3", fontWeight: "700", marginTop: 14, fontSize: 14 }}>
                {p.name}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  marginTop: 3,
                  color: p.speaking ? "#4FD69C" : "#8DA8AC",
                  fontWeight: p.speaking ? "700" : "400",
                }}
              >
                {p.muted ? "Silenciado" : p.speaking ? "Hablando" : "En la sala"}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Control bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 14,
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.10)",
          backgroundColor: "rgba(255,255,255,0.03)",
        }}
      >
        {controls.map((ctrl) => (
          <View key={ctrl.key} style={{ alignItems: "center", gap: 7, width: 72 }}>
            <PressableScale
              onPress={ctrl.toggle}
              accessibilityLabel={ctrl.label}
              pressedScale={0.9}
              hoverStyle={{
                backgroundColor: ctrl.active
                  ? "rgba(255,127,114,0.22)"
                  : "rgba(255,255,255,0.16)",
              }}
              style={{
                width: 52,
                height: 52,
                borderRadius: 9999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: ctrl.active ? `${ctrl.activeColor}26` : "rgba(255,255,255,0.10)",
                borderWidth: 1,
                borderColor: ctrl.active ? ctrl.activeColor : "rgba(255,255,255,0.13)",
              }}
            >
              <Ionicons name={ctrl.icon} size={22} color={ctrl.active ? ctrl.activeColor : "#E6F3F3"} />
            </PressableScale>
            <Text
              style={{
                fontWeight: "600",
                fontSize: 10,
                textAlign: "center",
                color: ctrl.active ? ctrl.activeColor : "#8DA8AC",
              }}
            >
              {ctrl.label}
            </Text>
          </View>
        ))}

        <View style={{ marginHorizontal: 2, width: 1, height: 52, backgroundColor: "rgba(255,255,255,0.10)" }} />

        <View style={{ alignItems: "center", gap: 7, width: 72 }}>
          <PressableScale
            accessibilityLabel="Colgar"
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
          <Text style={{ color: "#FF7F72", fontWeight: "700", fontSize: 10 }}>Colgar</Text>
        </View>
      </View>
    </View>
  )
}
