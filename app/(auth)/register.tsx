import { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { register } from "@/api/auth"

function Req({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: met ? "#4FD69C" : "rgba(255,255,255,0.13)",
        }}
      >
        <Text style={{ fontSize: 7, fontWeight: "800", color: met ? "#0A1620" : "#8DA8AC" }}>
          {met ? "✓" : "–"}
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: met ? "#4FD69C" : "#8DA8AC" }}>{text}</Text>
    </View>
  )
}

export default function RegisterScreen() {
  const { setUser } = useAuth()
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailDupe, setEmailDupe] = useState(false)
  const [error, setError] = useState("")

  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
  }
  const metCount = Object.values(checks).filter(Boolean).length
  const allMet = metCount === 4

  const handleRegister = async () => {
    if (!allMet) return
    setLoading(true)
    setEmailDupe(false)
    setError("")
    try {
      const res = await register(name, email, pw)
      setUser(res.user)
      router.replace("/(main)/chat")
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg === "EMAIL_DUPLICADO") {
        setEmailDupe(true)
      } else {
        setError(msg || "Error al crear la cuenta.")
      }
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

          <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 4 }}>Creá tu cuenta</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 16 }}>
            Un minuto y ya podés abrir tu primer servidor.
          </Text>

          {/* Email dupe error */}
          {emailDupe ? (
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
              <Text style={{ color: "#FF7F72", fontSize: 12, flex: 1 }}>
                Ese correo ya está en uso. ¿Querés iniciar sesión?
              </Text>
            </View>
          ) : null}

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

          {/* Name */}
          <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>Nombre</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Facundo Arroquy"
            placeholderTextColor="#5E7E82"
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
              borderColor: "rgba(255,255,255,0.13)",
            }}
          />

          {/* Email */}
          <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>Correo electrónico</Text>
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
              borderColor: emailDupe ? "#FF7F72" : "rgba(255,255,255,0.13)",
            }}
          />

          {/* Password */}
          <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>Contraseña</Text>
          <TextInput
            value={pw}
            onChangeText={setPw}
            placeholder="Mínimo 8 caracteres"
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
              borderColor: "rgba(255,255,255,0.13)",
            }}
          />

          {/* Password strength */}
          {pw.length > 0 && (
            <>
              <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor:
                        i < metCount
                          ? metCount <= 2
                            ? "#F0C24B"
                            : "#4FD69C"
                          : "rgba(255,255,255,0.13)",
                    }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 4, columnGap: 12, marginTop: 8, marginBottom: 12 }}>
                <Req met={checks.length} text="8 caracteres" />
                <Req met={checks.upper} text="Una mayúscula" />
                <Req met={checks.lower} text="Una minúscula" />
                <Req met={checks.number} text="Un número" />
              </View>
            </>
          )}

          {/* Register button */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading || !allMet}
            style={{
              width: "100%",
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              marginTop: 4,
              backgroundColor: allMet ? "#37D6C0" : "rgba(255,255,255,0.15)",
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                fontSize: 14,
                color: allMet ? "#04211D" : "#8DA8AC",
              }}
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Text>
          </TouchableOpacity>

          <Text style={{ color: "#8DA8AC", fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 20 }}>
            Al registrarte aceptás los términos de la plataforma.
          </Text>

          {/* Back to login */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12, gap: 4 }}>
            <Text style={{ color: "#8DA8AC", fontSize: 12 }}>¿Ya tenés cuenta?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={{ color: "#37D6C0", fontWeight: "600", fontSize: 12 }}>Iniciá sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
