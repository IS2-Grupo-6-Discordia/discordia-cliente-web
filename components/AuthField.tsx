import { useState } from "react"
import { View, Text, TextInput, Pressable } from "react-native"
import type { TextInputProps, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"

interface AuthFieldProps extends TextInputProps {
  label: string
  error?: boolean
  containerStyle?: ViewStyle
}

// Labelled auth input that owns its own focus state and shows a teal focus ring
// (or a red border on error). Keeps every auth screen's fields identical.
// When secureTextEntry is set it renders an eye toggle so the user can reveal
// what they are typing.
export default function AuthField({
  label,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...rest
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const isPassword = !!secureTextEntry

  return (
    <View style={containerStyle}>
      <Text
        style={{
          color: "#8DA8AC",
          fontSize: 10,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 1.1,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          placeholderTextColor="#5E7E82"
          secureTextEntry={isPassword && !revealed}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          style={[
            {
              width: "100%",
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 11,
              // Leave room for the eye button so text never runs under it.
              paddingRight: isPassword ? 44 : 12,
              color: "#E6F3F3",
              fontSize: 14,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: error ? "#FF7F72" : focused ? "#37D6C0" : "rgba(255,255,255,0.10)",
            },
            style,
          ]}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
            hitSlop={8}
            style={{
              position: "absolute",
              right: 4,
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#8DA8AC"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
