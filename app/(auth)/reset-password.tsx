import { useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { confirmPasswordReset } from "@/api/auth"
import { friendlyError } from "@/api/client"
import AuthBrand from "@/components/AuthBrand"
import AuthField from "@/components/AuthField"

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

export default function ResetPasswordScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ token?: string | string[] }>()

  // Query param can arrive as string | string[]; normalize to a single string.
  const rawToken = params.token
  const token = (Array.isArray(rawToken) ? rawToken[0] : rawToken) ?? ""

  const [pw, setPw] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
  }
  const metCount = Object.values(checks).filter(Boolean).length
  const allMet = metCount === 4
  const mismatch = confirm.length > 0 && pw !== confirm
  const canSubmit = allMet && pw === confirm

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError("")
    try {
      await confirmPasswordReset(token, pw, confirm)
      setDone(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  const Card = ({ children }: { children: React.ReactNode }) => (
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
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )

  // No token in the link: dead-end state with a way back.
  if (!token) {
    return (
      <Card>
        <AuthBrand
          title="Enlace no válido"
          subtitle="El enlace no es válido o está incompleto. Pedí uno nuevo."
        />
        <TouchableOpacity
          onPress={() => router.replace("/(auth)/recovery")}
          style={{
            width: "100%",
            borderRadius: 10,
            paddingVertical: 13,
            alignItems: "center",
            backgroundColor: "#37D6C0",
          }}
        >
          <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>
            Pedir un nuevo enlace
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace("/(auth)/login")}
          style={{ marginTop: 16, alignItems: "center" }}
        >
          <Text style={{ color: "#8DA8AC", fontSize: 12 }}>← Volver al inicio de sesión</Text>
        </TouchableOpacity>
      </Card>
    )
  }

  // Success state after the backend confirmed the reset.
  if (done) {
    return (
      <Card>
        <AuthBrand
          title="¡Listo!"
          subtitle="Tu contraseña se actualizó. Ya podés iniciar sesión con la nueva."
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
          <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>Iniciar sesión</Text>
        </TouchableOpacity>
      </Card>
    )
  }

  // Main form: choose and confirm a new password.
  return (
    <Card>
      <AuthBrand title="Nueva contraseña" subtitle="Elegí una contraseña nueva para tu cuenta." />

      {error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontWeight: "700" }}>!</Text>
          <Text style={{ color: "#FF9E94", fontSize: 12.5, flex: 1 }}>{error}</Text>
        </View>
      ) : null}

      <AuthField
        label="Nueva contraseña"
        value={pw}
        onChangeText={setPw}
        placeholder="Mínimo 8 caracteres"
        secureTextEntry
        containerStyle={{ marginBottom: 8 }}
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

      {/* Confirm password */}
      <AuthField
        label="Confirmar contraseña"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Repetí la contraseña"
        secureTextEntry
        error={mismatch}
        containerStyle={{ marginTop: pw.length > 0 ? 0 : 12, marginBottom: mismatch ? 4 : 8 }}
      />
      {mismatch ? (
        <Text style={{ color: "#FF7F72", fontSize: 11, marginBottom: 8 }}>
          Las contraseñas no coinciden.
        </Text>
      ) : null}

      {/* Submit */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading || !canSubmit}
        style={{
          width: "100%",
          borderRadius: 10,
          paddingVertical: 13,
          alignItems: "center",
          marginTop: 6,
          backgroundColor: canSubmit ? "#37D6C0" : "rgba(255,255,255,0.15)",
        }}
      >
        <Text
          style={{
            fontWeight: "700",
            fontSize: 14,
            color: canSubmit ? "#04211D" : "#8DA8AC",
          }}
        >
          {loading ? "Guardando..." : "Guardar contraseña"}
        </Text>
      </TouchableOpacity>

      {/* Back to login */}
      <TouchableOpacity
        onPress={() => router.replace("/(auth)/login")}
        style={{ marginTop: 16, alignItems: "center" }}
      >
        <Text style={{ color: "#8DA8AC", fontSize: 12 }}>← Volver al inicio de sesión</Text>
      </TouchableOpacity>
    </Card>
  )
}
