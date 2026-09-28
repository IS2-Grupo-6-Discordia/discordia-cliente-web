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
import { login } from "@/api/auth"
import { friendlyError } from "@/api/client"
import PressableScale from "@/components/PressableScale"
import AuthField from "@/components/AuthField"

export default function LoginScreen() {
  const { setUser } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(true)

  const handleLogin = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await login(email, password)
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

          {/* Divider */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.13)" }} />
            <Text style={{ color: "#8DA8AC", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.6 }}>o</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.13)" }} />
          </View>

          {/* Google button */}
          <PressableScale
            hoverStyle={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            style={{
              width: "100%",
              borderRadius: 10,
              paddingVertical: 13,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            <View style={{ width: 18, height: 18, borderRadius: 9999, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#1A1A1A", fontSize: 11, fontWeight: "900" }}>G</Text>
            </View>
            <Text style={{ color: "#E6F3F3", fontWeight: "600", fontSize: 14 }}>Continuar con Google</Text>
          </PressableScale>

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
