import { View } from "react-native"

const COLORS = {
  online: "#4FD69C",
  away: "#F0C24B",
  offline: "rgba(255,255,255,0.24)",
}

interface StatusDotProps {
  status: "online" | "away" | "offline"
}

export default function StatusDot({ status }: StatusDotProps) {
  return (
    <View
      style={{
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 8,
        height: 8,
        borderRadius: 9999,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: COLORS[status],
      }}
    />
  )
}
