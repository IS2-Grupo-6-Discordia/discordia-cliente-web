import { useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { register } from "@/api/auth"
import { friendlyError } from "@/api/client"
import AuthBrand from "@/components/AuthBrand"
import AuthField from "@/components/AuthField"

const NOTICE_ERROR = {
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  gap: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 14,
  backgroundColor: "rgba(255,127,114,0.12)",
  borderWidth: 1,
  borderColor: "rgba(255,127,114,0.30)",
}

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
        setError(friendlyError(err))
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
          <AuthBrand title="Creá tu cuenta" subtitle="Un minuto y ya podés abrir tu primer servidor." />

          {/* Email dupe error */}
          {emailDupe ? (
            <View style={NOTICE_ERROR}>
              <Text style={{ color: "#FF9E94", fontWeight: "700" }}>!</Text>
              <Text style={{ color: "#FF9E94", fontSize: 12.5, flex: 1 }}>
                Ese correo ya está en uso. ¿Querés iniciar sesión?
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={NOTICE_ERROR}>
              <Text style={{ color: "#FF9E94", fontWeight: "700" }}>!</Text>
              <Text style={{ color: "#FF9E94", fontSize: 12.5, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          <AuthField
            label="Nombre"
            value={name}
            onChangeText={setName}
            placeholder="Facundo Arroquy"
            containerStyle={{ marginBottom: 14 }}
          />

          <AuthField
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="vos@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailDupe}
            containerStyle={{ marginBottom: 14 }}
          />

          <AuthField
            label="Contraseña"
            value={pw}
            onChangeText={setPw}
            placeholder="Mínimo 8 caracteres"
            secureTextEntry
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
              borderRadius: 10,
              paddingVertical: 13,
              alignItems: "center",
              marginTop: 6,
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
