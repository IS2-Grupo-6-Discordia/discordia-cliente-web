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
import { requestRecovery } from "@/api/auth"
import AuthBrand from "@/components/AuthBrand"
import AuthField from "@/components/AuthField"

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
          {sent ? (
            <>
              <AuthBrand
                title="Revisá tu correo"
                subtitle="Si la dirección está registrada, vas a recibir un link para restablecer tu contraseña."
              />
              <TouchableOpacity
                onPress={() => router.replace("/(auth)/login")}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  paddingVertical: 13,
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
              <AuthBrand
                title="Recuperar contraseña"
                subtitle="Ingresá tu correo y te mandamos un link para restablecer tu contraseña."
              />

              <AuthField
                label="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                placeholder="vos@ejemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={{ marginBottom: 16 }}
              />

              <TouchableOpacity
                onPress={handleRecovery}
                disabled={loading}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  paddingVertical: 13,
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
