import { useState } from "react"
import { ActivityIndicator, Pressable, Text } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin"

export const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "357428623304-lnu4vkc3psjuocv2m984ic4tqglbpfes.apps.googleusercontent.com"

GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID })

export function isGoogleSignInAvailable(): boolean {
  return true
}

interface GoogleSignInButtonProps {
  loading?: boolean
  onCredential: (idToken: string) => void
  onUnavailable: () => void
}

export default function GoogleSignInButton({ loading, onCredential, onUnavailable }: GoogleSignInButtonProps) {
  const [picking, setPicking] = useState(false)
  const busy = loading || picking

  const handlePress = async () => {
    setPicking(true)
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      await GoogleSignin.signOut().catch(() => undefined)
      const response = await GoogleSignin.signIn()
      if (response.type !== "success") return
      const idToken = response.data.idToken
      if (idToken) onCredential(idToken)
      else onUnavailable()
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== statusCodes.SIGN_IN_CANCELLED && code !== statusCodes.IN_PROGRESS) onUnavailable()
    } finally {
      setPicking(false)
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Continuar con Google"
      style={({ pressed }) => ({
        width: "100%",
        borderRadius: 10,
        paddingVertical: 13,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: pressed && !busy ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
      })}
    >
      {loading ? (
        <>
          <ActivityIndicator size="small" color="#8DA8AC" />
          <Text style={{ color: "#8DA8AC", fontWeight: "600", fontSize: 14 }}>Ingresando con Google...</Text>
        </>
      ) : (
        <>
          <Ionicons name="logo-google" size={17} color="#E6F3F3" />
          <Text style={{ color: "#E6F3F3", fontWeight: "600", fontSize: 14 }}>Continuar con Google</Text>
        </>
      )}
    </Pressable>
  )
}
