import { useEffect, useState } from "react"
import { View, Text, TextInput, Image, Platform, ActivityIndicator } from "react-native"
import type { TextStyle, ViewStyle } from "react-native"
import * as ImagePicker from "expo-image-picker"
import ModalShell from "./ModalShell"
import PressableScale from "./PressableScale"

type PickedImage = Blob | { uri: string; name: string; type: string }

// Mirrored from the backend (microservicio-servidores) so invalid files are
// caught before uploading: name max 100, images JPEG/PNG/WebP up to 5 MB.
const NAME_MAX = 100
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const FORMAT_ERROR = "Formato no soportado. Usá JPEG, PNG o WebP."
const SIZE_ERROR = "La imagen no puede superar los 5 MB."

interface ServerSettingsModalProps {
  visible: boolean
  serverName: string
  currentIconUrl?: string | null
  currentBannerUrl?: string | null
  busy?: boolean
  error?: string
  onClose: () => void
  onSave: (fields: { name?: string; icon?: PickedImage; banner?: PickedImage }) => void
}

// HU-4 (#95): server configuration — edit name, icon and/or banner. The parent
// gates visibility to admins (CA2) and owns the API call + busy/error. This
// component validates inputs client-side before sending (CA3) and only reports
// the fields that actually changed, so the backend never gets an empty patch.
export default function ServerSettingsModal({
  visible,
  serverName,
  currentIconUrl = null,
  currentBannerUrl = null,
  busy = false,
  error = "",
  onClose,
  onSave,
}: ServerSettingsModalProps) {
  const [name, setName] = useState(serverName)
  const [pickedIcon, setPickedIcon] = useState<PickedImage | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [pickedBanner, setPickedBanner] = useState<PickedImage | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [pickError, setPickError] = useState("")

  // Reset to the server's current values each time the dialog opens, so a
  // cancelled edit never carries a stale draft into the next open.
  useEffect(() => {
    if (visible) {
      setName(serverName)
      setPickedIcon(null)
      setIconPreview(null)
      setPickedBanner(null)
      setBannerPreview(null)
      setPickError("")
    }
  }, [visible, serverName])

  // Pick one image and validate format + size client-side (CA3). Returns the
  // payload to upload plus a uri to preview, or null if cancelled/rejected.
  const pickImage = async (): Promise<{ picked: PickedImage; previewUri: string } | null> => {
    setPickError("")
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setPickError("Necesitamos permiso para acceder a tus fotos.")
      return null
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 })
    if (result.canceled) return null
    const asset = result.assets[0]
    if (!asset) return null

    if (Platform.OS === "web") {
      const blob = await (await fetch(asset.uri)).blob()
      if (!IMAGE_ALLOWED_TYPES.includes(blob.type)) {
        setPickError(FORMAT_ERROR)
        return null
      }
      if (blob.size > IMAGE_MAX_BYTES) {
        setPickError(SIZE_ERROR)
        return null
      }
      return { picked: blob, previewUri: asset.uri }
    }

    const type = asset.mimeType ?? ""
    if (type !== "" && !IMAGE_ALLOWED_TYPES.includes(type)) {
      setPickError(FORMAT_ERROR)
      return null
    }
    if (typeof asset.fileSize === "number" && asset.fileSize > IMAGE_MAX_BYTES) {
      setPickError(SIZE_ERROR)
      return null
    }
    return {
      picked: { uri: asset.uri, name: asset.fileName ?? "image.jpg", type: asset.mimeType ?? "image/jpeg" },
      previewUri: asset.uri,
    }
  }

  const handlePickIcon = async () => {
    const r = await pickImage()
    if (r) {
      setPickedIcon(r.picked)
      setIconPreview(r.previewUri)
    }
  }

  const handlePickBanner = async () => {
    const r = await pickImage()
    if (r) {
      setPickedBanner(r.picked)
      setBannerPreview(r.previewUri)
    }
  }

  const trimmedName = name.trim()
  const nameChanged = trimmedName !== serverName.trim()
  const nameTooLong = trimmedName.length > NAME_MAX
  const nameEmptyChange = nameChanged && trimmedName === ""
  const hasChanges = (nameChanged && trimmedName !== "") || !!pickedIcon || !!pickedBanner
  const canSave = !busy && hasChanges && !nameTooLong && !nameEmptyChange

  const handleSave = () => {
    if (!canSave) return
    const fields: { name?: string; icon?: PickedImage; banner?: PickedImage } = {}
    if (nameChanged && trimmedName !== "") fields.name = trimmedName
    if (pickedIcon) fields.icon = pickedIcon
    if (pickedBanner) fields.banner = pickedBanner
    onSave(fields)
  }

  const shownIcon = iconPreview ?? currentIconUrl
  const shownBanner = bannerPreview ?? currentBannerUrl

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Configuración del servidor"
      subtitle="Los cambios se reflejan para todos los miembros."
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

      {/* Nombre (CA3: validación de vacío/largo en cliente) */}
      <Text style={LABEL}>Nombre</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nombre del servidor"
        placeholderTextColor="#5E7E82"
        editable={!busy}
        style={[FIELD, { marginBottom: 6 }]}
      />
      <Text
        style={{
          color: nameTooLong || nameEmptyChange ? "#FF9E94" : "#5E7E82",
          fontSize: 11,
          textAlign: "right",
          marginBottom: 16,
        }}
      >
        {nameEmptyChange
          ? "El nombre no puede quedar vacío."
          : nameTooLong
            ? `El nombre no puede superar los ${NAME_MAX} caracteres.`
            : `${trimmedName.length}/${NAME_MAX}`}
      </Text>

      {/* Ícono */}
      <Text style={LABEL}>Ícono</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <View style={ICON_BOX}>
          {shownIcon ? (
            <Image source={{ uri: shownIcon }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <Text style={{ color: "#5E7E82", fontSize: 10 }}>Sin ícono</Text>
          )}
        </View>
        <PressableScale
          onPress={handlePickIcon}
          disabled={busy}
          hoverStyle={{ backgroundColor: "rgba(255,255,255,0.10)" }}
          style={PICK_BTN}
        >
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 13 }}>
            {shownIcon ? "Cambiar ícono" : "Elegir ícono"}
          </Text>
        </PressableScale>
      </View>

      {/* Banner */}
      <Text style={LABEL}>Banner</Text>
      <View style={BANNER_BOX}>
        {shownBanner ? (
          <Image source={{ uri: shownBanner }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <Text style={{ color: "#5E7E82", fontSize: 12 }}>Sin banner</Text>
        )}
      </View>
      <PressableScale
        onPress={handlePickBanner}
        disabled={busy}
        hoverStyle={{ backgroundColor: "rgba(255,255,255,0.10)" }}
        style={{ ...PICK_BTN, marginTop: 10, marginBottom: 18 }}
      >
        <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 13 }}>
          {shownBanner ? "Cambiar banner" : "Elegir banner"}
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
          onPress={handleSave}
          disabled={!canSave}
          accessibilityLabel="Guardar configuración del servidor"
          style={{
            flex: 1,
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: "center",
            backgroundColor: "#37D6C0",
            opacity: !canSave ? 0.5 : 1,
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
const FIELD: TextStyle = {
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: "#E6F3F3",
  fontSize: 14,
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
}
const ICON_BOX: ViewStyle = {
  width: 56,
  height: 56,
  borderRadius: 14,
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
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
const PICK_BTN: ViewStyle = {
  borderRadius: 10,
  paddingVertical: 11,
  paddingHorizontal: 16,
  alignItems: "center",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(255,255,255,0.06)",
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
