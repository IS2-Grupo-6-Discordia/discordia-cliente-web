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
import { useRouter, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { confirmPasswordReset } from "@/api/auth"
import { isPasswordStrongEnough, PasswordStrengthMeter } from "@/components/PasswordStrength"

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token?: string }>()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [linkInvalidated, setLinkInvalidated] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const passwordStrongEnough = isPasswordStrongEnough(newPassword)
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword
  const showMismatch = confirmPassword.length > 0 && !passwordsMatch

  const handleSubmit = async () => {
    if (!token) return
    if (!passwordStrongEnough) {
      setError("La contraseña no cumple los requisitos de arriba.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    setError("")
    try {
      await confirmPasswordReset(token, newPassword, confirmPassword)
      setDone(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo restablecer la contraseña."
      if (message.toLowerCase().includes("no es válido") || message.toLowerCase().includes("expiró")) {
        setLinkInvalidated(true)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = {
    width: "100%" as const,
    maxWidth: 340,
    alignSelf: "center" as const,
    borderRadius: 16,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  }

  const inputStyle = {
    width: "100%" as const,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#E6F3F3",
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  }

  const primaryButtonStyle = {
    width: "100%" as const,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center" as const,
    backgroundColor: "#37D6C0",
  }

  if (!token || linkInvalidated) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0A1620" }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
          <View style={cardStyle}>
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 8 }}>
              Link inválido
            </Text>
            <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 16, lineHeight: 20 }}>
              {token
                ? "Este link de recuperación ya no es válido: puede que ya lo hayas usado o que haya vencido. Pedí uno nuevo."
                : "Este link de recuperación no incluye la información necesaria. Pedí uno nuevo desde la pantalla de recupero."}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace("/(auth)/recovery")}
              style={primaryButtonStyle}
            >
              <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>
                Pedir un link nuevo
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  if (done) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0A1620" }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
          <View style={cardStyle}>
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 8 }}>
              Contraseña actualizada
            </Text>
            <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 16, lineHeight: 20 }}>
              Ya podés iniciar sesión con tu nueva contraseña.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace("/(auth)/login")}
              style={primaryButtonStyle}
            >
              <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>
                Ir a iniciar sesión
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
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
        <View style={cardStyle}>
          <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 4 }}>
            Elegí tu nueva contraseña
          </Text>
          <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 16, lineHeight: 20 }}>
            Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.
          </Text>

          {error ? (
            <View
              style={{
                padding: 10,
                borderRadius: 12,
                marginBottom: 12,
                backgroundColor: "rgba(255,127,114,0.15)",
                borderWidth: 1,
                borderColor: "#FF7F72",
              }}
            >
              <Text style={{ color: "#FF7F72", fontSize: 12 }}>{error}</Text>
            </View>
          ) : null}

          <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>
            Nueva contraseña
          </Text>
          <View style={{ position: "relative", justifyContent: "center" }}>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              placeholderTextColor="#5E7E82"
              secureTextEntry={!showNewPassword}
              style={[inputStyle, { paddingRight: 44 }]}
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ position: "absolute", right: 12 }}
            >
              <Ionicons
                name={showNewPassword ? "eye-off" : "eye"}
                size={18}
                color="#8DA8AC"
              />
            </TouchableOpacity>
          </View>

          <PasswordStrengthMeter pw={newPassword} />

          <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4, marginTop: 12 }}>
            Confirmar contraseña
          </Text>
          <View style={{ position: "relative", justifyContent: "center" }}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor="#5E7E82"
              secureTextEntry={!showConfirmPassword}
              style={[
                inputStyle,
                {
                  paddingRight: 44,
                  marginBottom: 4,
                  borderColor: showMismatch
                    ? "#FF7F72"
                    : passwordsMatch
                      ? "#4FD69C"
                      : "rgba(255,255,255,0.13)",
                },
              ]}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ position: "absolute", right: 12 }}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={18}
                color="#8DA8AC"
              />
            </TouchableOpacity>
          </View>
          {showMismatch ? (
            <Text style={{ color: "#FF7F72", fontSize: 11, marginBottom: 12 }}>
              Las contraseñas no coinciden.
            </Text>
          ) : passwordsMatch ? (
            <Text style={{ color: "#4FD69C", fontSize: 11, marginBottom: 12 }}>
              Las contraseñas coinciden.
            </Text>
          ) : (
            <View style={{ marginBottom: 12 }} />
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !passwordStrongEnough || !passwordsMatch}
            style={[
              primaryButtonStyle,
              {
                marginTop: 4,
                opacity: loading || !passwordStrongEnough || !passwordsMatch ? 0.6 : 1,
              },
            ]}
          >
            <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>
              {loading ? "Guardando..." : "Restablecer contraseña"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
