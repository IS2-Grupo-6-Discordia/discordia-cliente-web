import { useEffect, useState } from "react"
import { View, Text, Image, Platform, ActivityIndicator } from "react-native"
import type { TextStyle, ViewStyle } from "react-native"
import * as ImagePicker from "expo-image-picker"
import ModalShell from "./ModalShell"
import PressableScale from "./PressableScale"

type PickedBanner = Blob | { uri: string; name: string; type: string }

interface ServerSettingsModalProps {
  visible: boolean
  serverName: string
  currentBannerUrl?: string | null
  busy?: boolean
  error?: string
  onClose: () => void
  onSave: (banner: PickedBanner) => void
}

// HU-4 (#95): server configuration — banner only for now (name/icon editing are
// prepared on the backend but intentionally left out of this scope). The parent
// gates visibility to admins (CA2) and owns the API call + busy/error; this
// component only picks an image and previews it. Invalid files are rejected by
// the backend with 422, surfaced here through `error` without persisting (CA3).
export default function ServerSettingsModal({
  visible,
  serverName,
  currentBannerUrl = null,
  busy = false,
  error = "",
  onClose,
  onSave,
}: ServerSettingsModalProps) {
  const [picked, setPicked] = useState<PickedBanner | null>(null)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [pickError, setPickError] = useState("")

  // Reset the pending selection each time the dialog opens, so a cancelled edit
  // never carries a stale image into the next open.
  useEffect(() => {
    if (visible) {
      setPicked(null)
      setPreviewUri(null)
      setPickError("")
    }
  }, [visible])

  const handlePickBanner = async () => {
    setPickError("")
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setPickError("Necesitamos permiso para acceder a tus fotos.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset) return
    if (Platform.OS === "web") {
      const blob = await (await fetch(asset.uri)).blob()
      setPicked(blob)
      setPreviewUri(asset.uri)
    } else {
      setPicked({
        uri: asset.uri,
        name: asset.fileName ?? "banner.jpg",
        type: asset.mimeType ?? "image/jpeg",
      })
      setPreviewUri(asset.uri)
    }
  }

  // Show the freshly picked image if there is one, otherwise the current banner.
  const shownUri = previewUri ?? currentBannerUrl

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Configuración del servidor"
      subtitle={`Editá el banner de ${serverName || "tu servidor"}. Se muestra para todos los miembros.`}
    >
      {error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}
      {pickError ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{pickError}</Text>
        </View>
      ) : null}

      <Text style={LABEL}>Banner</Text>
      <View style={BANNER_BOX}>
        {shownUri ? (
          <Image source={{ uri: shownUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <Text style={{ color: "#5E7E82", fontSize: 12 }}>Sin banner</Text>
        )}
      </View>

      <PressableScale
        onPress={handlePickBanner}
        disabled={busy}
        hoverStyle={{ backgroundColor: "rgba(255,255,255,0.10)" }}
        style={{
          marginTop: 10,
          marginBottom: 18,
          borderRadius: 10,
          paddingVertical: 11,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      >
        <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 13 }}>
          {shownUri ? "Cambiar banner" : "Elegir banner"}
        </Text>
      </PressableScale>

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
          onPress={() => picked && onSave(picked)}
          disabled={!picked || busy}
          accessibilityLabel="Guardar banner del servidor"
          style={{
            flex: 1,
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: "center",
            backgroundColor: "#37D6C0",
            opacity: !picked || busy ? 0.5 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#04211D" />
          ) : (
            <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>Guardar</Text>
          )}
        </PressableScale>
      </View>
    </ModalShell>
  )
}

// Local copies of the shared field/label/notice styles used across the app's
// modals, kept here so this component stays self-contained.
const LABEL: TextStyle = {
  color: "#8DA8AC",
  fontSize: 10,
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: 1.1,
  marginBottom: 6,
}
const BANNER_BOX: ViewStyle = {
  width: "100%",
  height: 110,
  borderRadius: 10,
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
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
