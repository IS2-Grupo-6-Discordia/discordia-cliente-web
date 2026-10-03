import { TouchableOpacity, View } from "react-native"

interface ToggleProps {
  on: boolean
  onToggle: () => void
}

export default function Toggle({ on, onToggle }: ToggleProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={{
        width: 38,
        height: 21,
        borderRadius: 11,
        backgroundColor: on ? "#4FD69C" : "rgba(255,255,255,0.15)",
        justifyContent: "center",
        paddingHorizontal: 2.5,
      }}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: "#fff",
          alignSelf: on ? "flex-end" : "flex-start",
        }}
      />
    </TouchableOpacity>
  )
}
