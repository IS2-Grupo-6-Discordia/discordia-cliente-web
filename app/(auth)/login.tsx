import { useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import { login, loginWithGoogle } from "@/api/auth"
import { ApiError, friendlyError } from "@/api/client"
import PressableScale from "@/components/PressableScale"
import AuthField from "@/components/AuthField"
import GoogleSignInButton, { isGoogleSignInAvailable } from "@/components/GoogleSignInButton"

const GOOGLE_UNAVAILABLE =
  "No pudimos conectarnos con Google. Ingresá con tu email y contraseña o probá de nuevo en un rato."

export default function LoginScreen() {
  const { setUser, signedOutReason, clearSignedOutReason } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(true)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleNotice, setGoogleNotice] = useState("")
  const [googleAttempt, setGoogleAttempt] = useState(0)

  const handleGoogleCredential = async (idToken: string) => {
    setGoogleLoading(true)
    setGoogleNotice("")
    setError("")
    try {
      const res = await loginWithGoogle(idToken)
      clearSignedOutReason()
      setUser(res.user)
      router.replace("/(main)/chat")
    } catch (err) {
      const unavailable =
        (err instanceof ApiError && err.status >= 500) ||
        err instanceof TypeError ||
        (err instanceof Error && err.name === "AbortError")
      if (unavailable) setGoogleNotice(GOOGLE_UNAVAILABLE)
      else setError(friendlyError(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  const retryGoogle = () => {
    setGoogleNotice("")
    setGoogleAttempt((n) => n + 1)
  }

  const handleLogin = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await login(email, password)
      clearSignedOutReason()
      setUser(res.user)
      router.replace("/(main)/chat")
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0A1620" }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: 340,
            alignSelf: "center",
            borderRadius: 16,
            padding: 24,
            backgroundColor: "rgba(255,255,255,0.055)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.13)",
          }}
        >
          {/* Brand */}
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
            <Text style={{ color: "#F2FAFA", fontWeight: "800", fontSize: 22, letterSpacing: -0.3 }}>
              Entrá a tu cuenta
            </Text>
            <Text style={{ color: "#8DA8AC", fontSize: 12.5, marginTop: 6, textAlign: "center", lineHeight: 18 }}>
              Tus servidores, canales y llamadas siguen donde los dejaste.
            </Text>
          </View>

          {signedOutReason && !error ? (
            <View
              accessibilityRole="alert"
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                padding: 10,
                borderRadius: 12,
                marginBottom: 12,
                backgroundColor: "rgba(240,194,75,0.10)",
                borderWidth: 1,
                borderColor: "rgba(240,194,75,0.45)",
              }}
            >
              <Ionicons
                name={signedOutReason === "suspended" ? "ban-outline" : "time-outline"}
                size={15}
                color="#F0C24B"
                style={{ marginTop: 1 }}
              />
              <Text style={{ color: "#F3DFA6", fontSize: 12, flex: 1, lineHeight: 17 }}>
                {signedOutReason === "suspended"
                  ? "Tu cuenta fue suspendida y se cerró tu sesión. Si creés que es un error, contactá al soporte de Discordia."
                  : "Tu sesión expiró. Iniciá sesión de nuevo."}
              </Text>
            </View>
          ) : null}

          {/* Error */}
          {error ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                padding: 10,
                borderRadius: 12,
                marginBottom: 12,
                backgroundColor: "rgba(255,127,114,0.15)",
                borderWidth: 1,
                borderColor: "#FF7F72",
              }}
            >
              <Text style={{ color: "#FF7F72", fontWeight: "700" }}>!</Text>
              <Text style={{ color: "#FF7F72", fontSize: 12, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <AuthField
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="vos@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={!!error}
            containerStyle={{ marginBottom: 14 }}
          />

          {/* Password */}
          <AuthField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            error={!!error}
            containerStyle={{ marginBottom: 12 }}
          />

          {/* Remember + forgot password */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <TouchableOpacity
              onPress={() => setRemember((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <View
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 5,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: remember ? "#37D6C0" : "transparent",
                  borderWidth: 1,
                  borderColor: remember ? "#37D6C0" : "rgba(255,255,255,0.20)",
                }}
              >
                {remember ? <Ionicons name="checkmark" size={12} color="#04211D" /> : null}
              </View>
              <Text style={{ color: "#8DA8AC", fontSize: 12 }}>Mantener la sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(auth)/recovery")}>
              <Text style={{ color: "#37D6C0", fontSize: 12, fontWeight: "600" }}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login button */}
          <PressableScale
            onPress={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              borderRadius: 10,
              paddingVertical: 13,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              backgroundColor: loading ? "rgba(255,255,255,0.15)" : "#37D6C0",
            }}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#8DA8AC" />
                <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 14 }}>Ingresando...</Text>
              </>
            ) : (
              <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>Iniciar sesión</Text>
            )}
          </PressableScale>

          {isGoogleSignInAvailable() ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.13)" }} />
                <Text style={{ color: "#8DA8AC", fontSize: 12 }}>o</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.13)" }} />
              </View>

              <View>
                {googleNotice ? (
                  <View
                    accessibilityRole="alert"
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      gap: 8,
                      backgroundColor: "rgba(240,194,75,0.10)",
                      borderWidth: 1,
                      borderColor: "rgba(240,194,75,0.45)",
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                      <Ionicons name="cloud-offline-outline" size={16} color="#F0C24B" style={{ marginTop: 1 }} />
                      <Text style={{ color: "#F3DFA6", fontSize: 12.5, lineHeight: 18, flex: 1 }}>{googleNotice}</Text>
                    </View>
                    <TouchableOpacity onPress={retryGoogle} style={{ alignSelf: "flex-end" }}>
                      <Text style={{ color: "#F0C24B", fontSize: 12.5, fontWeight: "700" }}>Reintentar con Google</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <GoogleSignInButton
                    key={googleAttempt}
                    loading={googleLoading}
                    onCredential={handleGoogleCredential}
                    onUnavailable={() => setGoogleNotice(GOOGLE_UNAVAILABLE)}
                  />
                )}
              </View>
            </>
          ) : null}

          {/* Register link */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, gap: 4 }}>
            <Text style={{ color: "#8DA8AC", fontSize: 12 }}>¿Todavía no tenés cuenta?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text style={{ color: "#37D6C0", fontWeight: "600", fontSize: 12 }}>Registrate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
