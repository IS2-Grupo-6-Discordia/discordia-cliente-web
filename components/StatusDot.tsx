import { View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { PresenceStatus, UserStatus } from "@/api/types"

export const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: "#4FD69C",
  away: "#F0C24B",
  dnd: "#E5484D",
  offline: "#6F8589",
}

export const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: "En línea",
  away: "Ausente",
  dnd: "No molestar",
  offline: "Desconectado/a",
}

interface PresenceDotProps {
  status: PresenceStatus | UserStatus
  size?: number
  ringColor?: string
}

export function PresenceDot({ status, size = 10, ringColor = "#0A1620" }: PresenceDotProps) {
  const shown: PresenceStatus = status === "invisible" ? "offline" : status
  const color = STATUS_COLORS[shown]
  const ring = Math.max(2, Math.round(size * 0.22))
  const outer = size + ring * 2

  return (
    <View
      style={{
        width: outer,
        height: outer,
        borderRadius: 9999,
        backgroundColor: ringColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 9999,
          overflow: shown === "away" ? "visible" : "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: shown === "offline" ? "transparent" : shown === "away" ? ringColor : color,
          borderWidth: shown === "offline" ? Math.max(2, size * 0.26) : 0,
          borderColor: color,
        }}
      >
        {shown === "away" ? (
          <Ionicons
            name="time"
            size={Math.round(size * 1.24)}
            color={color}
            style={{ position: "absolute", lineHeight: Math.round(size * 1.24) }}
          />
        ) : null}
        {shown === "dnd" ? (
          <View
            style={{
              width: size * 0.6,
              height: Math.max(2, size * 0.2),
              borderRadius: 9999,
              backgroundColor: ringColor,
            }}
          />
        ) : null}
      </View>
    </View>
  )
}

interface StatusDotProps {
  status: PresenceStatus
  ringColor?: string
}

export default function StatusDot({ status, ringColor = "#101C25" }: StatusDotProps) {
  return (
    <View style={{ position: "absolute", right: -3, bottom: -3 }}>
      <PresenceDot status={status} size={8} ringColor={ringColor} />
    </View>
  )
}
