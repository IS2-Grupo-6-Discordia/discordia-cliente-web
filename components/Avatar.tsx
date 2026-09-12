import { View, Text } from "react-native"

interface AvatarProps {
  initials: string
  size?: number
}

export default function Avatar({ initials, size = 28 }: AvatarProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.13)",
      }}
    >
      <Text
        style={{
          color: "#E6F3F3",
          fontWeight: "700",
          fontSize: size * 0.36,
        }}
      >
        {initials}
      </Text>
    </View>
  )
}
