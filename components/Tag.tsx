import { View, Text } from "react-native"
import type { ReactNode } from "react"

const COLORS = {
  ok: { color: "#4FD69C", bg: "rgba(79,214,156,0.15)", border: "#4FD69C" },
  sus: { color: "#FF7F72", bg: "rgba(255,127,114,0.15)", border: "#FF7F72" },
  warn: { color: "#F0C24B", bg: "rgba(240,194,75,0.15)", border: "#F0C24B" },
}

interface TagProps {
  type: "ok" | "sus" | "warn"
  children: ReactNode
}

export default function Tag({ type, children }: TagProps) {
  const c = COLORS[type]
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 9999,
        backgroundColor: c.bg,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 9999,
          backgroundColor: c.color,
        }}
      />
      <Text style={{ color: c.color, fontSize: 10, fontWeight: "700" }}>
        {children}
      </Text>
    </View>
  )
}
