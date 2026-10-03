import { View, Text, Platform } from "react-native"

interface AuthBrandProps {
  title: string
  subtitle: string
}

// Centered brand block shared by every auth screen: the glowing "D" mark plus
// the screen title and a one-line subtitle.
export default function AuthBrand({ title, subtitle }: AuthBrandProps) {
  return (
    <View style={{ alignItems: "center", marginBottom: 22 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: "#37D6C0",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
          ...(Platform.OS === "web"
            ? ({ boxShadow: "0 8px 24px -6px rgba(55,214,192,0.6)" } as object)
            : {}),
        }}
      >
        <Text style={{ color: "#04211D", fontWeight: "900", fontSize: 24 }}>D</Text>
      </View>
      <Text style={{ color: "#F2FAFA", fontWeight: "800", fontSize: 22, letterSpacing: -0.3, textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ color: "#8DA8AC", fontSize: 12.5, marginTop: 6, textAlign: "center", lineHeight: 18 }}>
        {subtitle}
      </Text>
    </View>
  )
}
