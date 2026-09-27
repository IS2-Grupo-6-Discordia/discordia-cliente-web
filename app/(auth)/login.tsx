import { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { login } from "@/api/auth"

export default function LoginScreen() {
  const { setUser } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await login(email, password)
      setUser(res.user)
      router.replace("/(main)/chat")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email o contraseña incorrectos.")
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <View style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: "#37D6C0", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#04211D", fontWeight: "900", fontSize: 14 }}>D</Text>
            </View>
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 16 }}>Discordia</Text>
          </View>

          {/* Header */}
          <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 4 }}>Entrá a tu cuenta</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 16 }}>
            Tus servidores, canales y llamadas siguen donde los dejaste.
          </Text>

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
          <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>
            Correo electrónico
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="vos@ejemplo.com"
            placeholderTextColor="#5E7E82"
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              width: "100%",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: "#E6F3F3",
              fontSize: 14,
              marginBottom: 12,
              backgroundColor: "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: error ? "#FF7F72" : "rgba(255,255,255,0.13)",
            }}
          />

          {/* Password */}
          <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>
            Contraseña
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#5E7E82"
            secureTextEntry
            style={{
              width: "100%",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: "#E6F3F3",
              fontSize: 14,
              marginBottom: 8,
              backgroundColor: "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: error ? "#FF7F72" : "rgba(255,255,255,0.13)",
            }}
          />

          {/* Forgot password */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ color: "#8DA8AC", fontSize: 12 }}>Mantener la sesión</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/recovery")}>
              <Text style={{ color: "#37D6C0", fontSize: 12, fontWeight: "600" }}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              borderRadius: 12,
              paddingVertical: 12,
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
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.13)" }} />
            <Text style={{ color: "#8DA8AC", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.6 }}>o</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.13)" }} />
          </View>

          {/* Google button */}
          <TouchableOpacity
            style={{
              width: "100%",
              borderRadius: 12,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
            }}
          >
            <View style={{ width: 16, height: 16, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#E6F3F3", fontSize: 10, fontWeight: "800" }}>G</Text>
            </View>
            <Text style={{ color: "#E6F3F3", fontWeight: "600", fontSize: 14 }}>Continuar con Google</Text>
          </TouchableOpacity>

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
