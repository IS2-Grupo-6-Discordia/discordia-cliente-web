import { useState } from "react"
import { View, Text, TouchableOpacity, ScrollView } from "react-native"

const PARTICIPANTS = [
  { id: "1", name: "Facundo", avatar: "FA", speaking: true, muted: false },
  { id: "2", name: "Mora B.", avatar: "MB", speaking: false, muted: false },
  { id: "3", name: "Juanpi", avatar: "JP", speaking: false, muted: true },
  { id: "4", name: "Lucía R.", avatar: "LR", speaking: false, muted: false },
]

export default function VoiceScreen() {
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [sharing, setSharing] = useState(false)

  const controls = [
    {
      icon: muted ? "✕" : "🎙",
      label: muted ? "Activar mic" : "Silenciar",
      active: muted,
      toggle: () => setMuted((m) => !m),
    },
    {
      icon: deafened ? "🔕" : "🔈",
      label: deafened ? "Activar audio" : "Silenciar audio",
      active: deafened,
      toggle: () => setDeafened((d) => !d),
    },
    {
      icon: "🖥",
      label: sharing ? "Detener" : "Pantalla",
      active: sharing,
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
          height: 48,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.13)",
          backgroundColor: "rgba(255,255,255,0.055)",
        }}
      >
        <Text style={{ color: "#4FD69C", fontSize: 16 }}>♪</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 13.5 }}>Sala 1</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 10 }}>FIUBA · IS2 · 4 conectados</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 9999,
            backgroundColor: "rgba(79,214,156,0.15)",
            borderWidth: 1,
            borderColor: "#4FD69C",
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: "#4FD69C" }} />
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
                paddingVertical: 32,
                paddingHorizontal: 24,
                width: "47%",
                backgroundColor: "rgba(255,255,255,0.055)",
                borderWidth: 2,
                borderColor: p.speaking ? "#4FD69C" : "rgba(255,255,255,0.13)",
                borderRadius: 13,
              }}
            >
              {p.speaking && (
                <View
                  style={{
                    position: "absolute",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 9999,
                    top: 12,
                    right: 14,
                    backgroundColor: "rgba(79,214,156,0.15)",
                    borderWidth: 1,
                    borderColor: "#4FD69C",
                  }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: "#4FD69C" }} />
                  <Text style={{ color: "#4FD69C", fontWeight: "700", fontSize: 10 }}>Hablando</Text>
                </View>
              )}

              <View
                style={{
                  borderRadius: 9999,
                  alignItems: "center",
                  justifyContent: "center",
                  width: 72,
                  height: 72,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderWidth: 3,
                  borderColor: p.speaking ? "#4FD69C" : "rgba(255,255,255,0.13)",
                }}
              >
                <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 24 }}>{p.avatar}</Text>
              </View>

              <Text style={{ color: "#E6F3F3", fontWeight: "700", marginTop: 14, fontSize: 14 }}>{p.name}</Text>
              {p.muted && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Text style={{ color: "#FF7F72" }}>✕</Text>
                  <Text style={{ color: "#8DA8AC", fontSize: 11 }}>Silenciado</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Control bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.13)",
          backgroundColor: "rgba(255,255,255,0.055)",
        }}
      >
        {controls.map((ctrl) => (
          <TouchableOpacity
            key={ctrl.label}
            onPress={ctrl.toggle}
            style={{
              alignItems: "center",
              gap: 6,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              minWidth: 80,
              backgroundColor: ctrl.active ? "rgba(255,127,114,0.15)" : "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: ctrl.active ? "#FF7F72" : "rgba(255,255,255,0.13)",
            }}
          >
            <Text style={{ fontSize: 22 }}>{ctrl.icon}</Text>
            <Text
              style={{ fontWeight: "600", fontSize: 10, color: ctrl.active ? "#FF7F72" : "#8DA8AC" }}
            >
              {ctrl.label}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={{ marginHorizontal: 4, width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.13)" }} />

        <TouchableOpacity
          style={{
            alignItems: "center",
            gap: 6,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            minWidth: 80,
            backgroundColor: "rgba(255,127,114,0.15)",
            borderWidth: 1,
            borderColor: "#FF7F72",
          }}
        >
          <Text style={{ fontSize: 22 }}>⏻</Text>
          <Text style={{ color: "#FF7F72", fontWeight: "700", fontSize: 10 }}>Colgar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
