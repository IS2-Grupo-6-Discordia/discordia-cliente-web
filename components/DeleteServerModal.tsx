import { useEffect, useState } from "react"
import { View, Text, TextInput, ActivityIndicator } from "react-native"
import type { TextStyle, ViewStyle } from "react-native"
import ModalShell from "./ModalShell"
import PressableScale from "./PressableScale"

interface DeleteServerModalProps {
  visible: boolean
  serverName: string
  busy?: boolean
  error?: string
  onClose: () => void
  onConfirm: (confirmationName: string) => void
}

// HU-6 (#97): the owner permanently deletes a server. The primary button stays
// disabled until the typed name matches the server's exactly (CA3); the backend
// enforces the same check and deletes nothing on a mismatch. Hiding this from
// non-owners (CA2) is the caller's job — it only renders this for the owner.
export default function DeleteServerModal({
  visible,
  serverName,
  busy = false,
  error = "",
  onClose,
  onConfirm,
}: DeleteServerModalProps) {
  const [confirmName, setConfirmName] = useState("")

  useEffect(() => {
    if (visible) setConfirmName("")
  }, [visible])

  const matches = serverName !== "" && confirmName === serverName

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Eliminar servidor"
      subtitle={`Esto elimina ${serverName || "el servidor"} con todos sus canales, mensajes y roles. No se puede deshacer.`}
    >
      {error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      <Text style={LABEL}>Escribí el nombre del servidor para confirmar</Text>
      <TextInput
        value={confirmName}
        onChangeText={setConfirmName}
        placeholder={serverName}
        placeholderTextColor="#5E7E82"
        autoCapitalize="none"
        editable={!busy}
        style={[FIELD, { marginBottom: 18 }]}
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <PressableScale
          onPress={onClose}
          disabled={busy}
          hoverStyle={{ backgroundColor: "rgba(255,255,255,0.10)" }}
          style={{
            flex: 1,
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }}>Cancelar</Text>
        </PressableScale>
        <PressableScale
          onPress={() => onConfirm(confirmName)}
          disabled={!matches || busy}
          accessibilityLabel="Eliminar servidor definitivamente"
          style={{
            flex: 1,
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: "center",
            backgroundColor: "#FF7F72",
            opacity: !matches || busy ? 0.5 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#04211D" />
          ) : (
            <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>Eliminar</Text>
          )}
        </PressableScale>
      </View>
    </ModalShell>
  )
}

const LABEL: TextStyle = {
  color: "#8DA8AC",
  fontSize: 10,
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: 1.1,
  marginBottom: 6,
}
const FIELD: TextStyle = {
  width: "100%",
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 11,
  color: "#E6F3F3",
  fontSize: 14,
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
}
const NOTICE_ERROR: ViewStyle = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 14,
  backgroundColor: "rgba(255,127,114,0.12)",
  borderWidth: 1,
  borderColor: "rgba(255,127,114,0.30)",
}
