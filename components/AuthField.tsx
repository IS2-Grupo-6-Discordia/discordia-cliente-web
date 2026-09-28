import { useState } from "react"
import { View, Text, TextInput } from "react-native"
import type { TextInputProps, ViewStyle } from "react-native"

interface AuthFieldProps extends TextInputProps {
  label: string
  error?: boolean
  containerStyle?: ViewStyle
}

// Labelled auth input that owns its own focus state and shows a teal focus ring
// (or a red border on error). Keeps every auth screen's fields identical.
export default function AuthField({
  label,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false)

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
      <TextInput
        placeholderTextColor="#5E7E82"
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
    </View>
  )
}
