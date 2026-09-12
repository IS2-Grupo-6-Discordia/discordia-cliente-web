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
import { requestRecovery } from "@/api/auth"

export default function RecoveryScreen() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleRecovery = async () => {
    setLoading(true)
    try {
      await requestRecovery(email)
    } catch {
      // Siempre mostramos confirmación
    } finally {
      setLoading(false)
      setSent(true)
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

          {sent ? (
            <>
              <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 4 }}>Revisá tu correo</Text>
              <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 16, lineHeight: 20 }}>
                Si la dirección está registrada, vas a recibir un link para restablecer tu contraseña.
              </Text>
              <TouchableOpacity
                onPress={() => router.replace("/(auth)/login")}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: "#37D6C0",
                }}
              >
                <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>
                  Volver al inicio de sesión
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 4 }}>
                Recuperar contraseña
              </Text>
              <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 16, lineHeight: 20 }}>
                Ingresá tu correo y te mandamos un link para restablecer tu contraseña.
              </Text>

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
                  borderColor: "rgba(255,255,255,0.13)",
                }}
              />

              <TouchableOpacity
                onPress={handleRecovery}
                disabled={loading}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: "#37D6C0",
                }}
              >
                <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>
                  {loading ? "Enviando..." : "Enviar link de recuperación"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.back()}
                style={{ marginTop: 16, alignItems: "center" }}
              >
                <Text style={{ color: "#8DA8AC", fontSize: 12 }}>
                  ← Volver al inicio de sesión
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
