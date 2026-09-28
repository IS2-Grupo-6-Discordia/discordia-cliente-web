import { useEffect, useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native"
import * as ImagePicker from "expo-image-picker"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import { getMe, updateProfile, updateAvatar } from "@/api/auth"
import { ApiError, friendlyError } from "@/api/client"
import Avatar from "@/components/Avatar"
import type { User } from "@/api/types"

const NAME_MAX = 80
const BIO_MAX = 300

function ErrorBox({ text }: { text: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: 14,
        backgroundColor: "rgba(255,127,114,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,127,114,0.30)",
      }}
    >
      <Text style={{ color: "#FF9E94", fontWeight: "700" }}>!</Text>
      <Text style={{ color: "#FF9E94", fontSize: 12.5, flex: 1 }}>{text}</Text>
    </View>
  )
}

const labelStyle = {
  color: "#8DA8AC",
  fontSize: 10,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  marginBottom: 4,
}

const inputStyle = {
  width: "100%" as const,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 11,
  color: "#E6F3F3",
  fontSize: 14,
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
}

const CARD_BG = "#0B1822"

// InfoRow: a labelled read-only value used in the profile summary view.
function InfoRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={{ color: muted ? "#8DA8AC" : "#E6F3F3", fontSize: 14, lineHeight: 20 }}>
        {value}
      </Text>
    </View>
  )
}

function formatMemberSince(iso?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default function ProfileScreen() {
  const { user, setUser } = useAuth()
  const router = useRouter()

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/(main)/chat")
  }

  const [profile, setProfile] = useState<User | null>(user)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState("")

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const fresh = await getMe()
        if (!active) return
        setProfile(fresh)
        setUser(fresh)
      } catch (err) {
        if (!active) return
        setLoadError(friendlyError(err))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startEditing = () => {
    if (!profile) return
    setName(profile.name)
    setBio(profile.bio ?? "")
    setFormError("")
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setFormError("")
  }

  const handleSave = async () => {
    if (!profile) return
    const trimmedName = name.trim()
    if (trimmedName === "") {
      setFormError("El nombre no puede quedar vacío.")
      return
    }

    const updates: { name?: string; bio?: string | null } = {}
    if (trimmedName !== profile.name) {
      updates.name = trimmedName
    }
    const nextBio = bio.trim() === "" ? null : bio
    if (nextBio !== (profile.bio ?? null)) {
      updates.bio = nextBio
    }

    if (Object.keys(updates).length === 0) {
      setEditing(false)
      return
    }

    setSaving(true)
    setFormError("")
    try {
      const updated = await updateProfile(updates)
      setProfile(updated)
      setUser(updated)
      setEditing(false)
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleChangePhoto = async () => {
    setAvatarError("")

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setAvatarError("Necesitamos permiso para acceder a tus fotos.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })

    if (result.canceled) return

    const asset = result.assets[0]
    if (!asset) return

    setAvatarLoading(true)
    try {
      let updated: User
      if (Platform.OS === "web") {
        const blob = await (await fetch(asset.uri)).blob()
        updated = await updateAvatar(blob)
      } else {
        updated = await updateAvatar({
          uri: asset.uri,
          name: asset.fileName ?? "avatar.jpg",
          type: asset.mimeType ?? "image/jpeg",
        })
      }
      setProfile(updated)
      setUser(updated)
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setAvatarError("La imagen no es válida o es demasiado grande.")
      } else {
        setAvatarError(friendlyError(err))
      }
    } finally {
      setAvatarLoading(false)
    }
  }

  const display = profile ?? user
  const memberSince = formatMemberSince(display?.createdAt)

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0A1620" }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: 420, alignSelf: "center", marginBottom: 12 }}>
          <TouchableOpacity
            onPress={goBack}
            accessibilityLabel="Volver"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              alignSelf: "flex-start",
              paddingVertical: 6,
              paddingRight: 10,
            }}
          >
            <Ionicons name="chevron-back" size={18} color="#8DA8AC" />
            <Text style={{ color: "#8DA8AC", fontSize: 13, fontWeight: "600" }}>Volver</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            width: "100%",
            maxWidth: 420,
            alignSelf: "center",
            borderRadius: 16,
            backgroundColor: CARD_BG,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            overflow: "hidden",
            ...(Platform.OS === "web"
              ? ({ boxShadow: "0 24px 60px -24px rgba(0,0,0,0.7)" } as object)
              : { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 18 } }),
          }}
        >
          {/* Banner */}
          <View
            style={{
              height: 92,
              backgroundColor: "#2FAE9C",
              ...(Platform.OS === "web"
                ? ({ backgroundImage: "linear-gradient(135deg, #37D6C0 0%, #2E8FB8 100%)" } as object)
                : {}),
            }}
          />

          <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
            {loading ? (
              <View style={{ paddingVertical: 44, alignItems: "center" }}>
                <ActivityIndicator color="#37D6C0" />
                <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 12 }}>
                  Cargando tu perfil...
                </Text>
              </View>
            ) : !display ? (
              <View style={{ paddingTop: 24 }}>
                {loadError ? <ErrorBox text={loadError} /> : null}
                <Text style={{ color: "#8DA8AC", fontSize: 13 }}>
                  No encontramos tus datos de perfil.
                </Text>
              </View>
            ) : (
              <>
                {/* Avatar overlapping the banner, with a camera badge */}
                <View style={{ alignItems: "center", marginTop: -46, marginBottom: 14 }}>
                  <View style={{ position: "relative" }}>
                    <View style={{ borderRadius: 9999, borderWidth: 4, borderColor: CARD_BG }}>
                      <Avatar initials={display.avatar} size={92} uri={display.avatarUrl} />
                    </View>
                    <TouchableOpacity
                      onPress={handleChangePhoto}
                      disabled={avatarLoading}
                      accessibilityLabel="Cambiar foto"
                      style={{
                        position: "absolute",
                        right: -2,
                        bottom: 2,
                        width: 32,
                        height: 32,
                        borderRadius: 9999,
                        backgroundColor: "#37D6C0",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 3,
                        borderColor: CARD_BG,
                      }}
                    >
                      {avatarLoading ? (
                        <ActivityIndicator size="small" color="#04211D" />
                      ) : (
                        <Ionicons name="camera" size={15} color="#04211D" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {avatarError ? <ErrorBox text={avatarError} /> : null}

                {editing ? (
                  <>
                    {formError ? <ErrorBox text={formError} /> : null}

                    <Text style={labelStyle}>Nombre</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Tu nombre"
                      placeholderTextColor="#5E7E82"
                      maxLength={NAME_MAX}
                      style={{ ...inputStyle, marginBottom: 14 }}
                    />

                    <Text style={labelStyle}>Bio</Text>
                    <TextInput
                      value={bio}
                      onChangeText={setBio}
                      placeholder="Contá algo sobre vos"
                      placeholderTextColor="#5E7E82"
                      maxLength={BIO_MAX}
                      multiline
                      numberOfLines={4}
                      style={{
                        ...inputStyle,
                        marginBottom: 4,
                        minHeight: 90,
                        textAlignVertical: "top",
                      }}
                    />
                    <Text style={{ color: "#5E7E82", fontSize: 10, textAlign: "right", marginBottom: 18 }}>
                      {bio.length}/{BIO_MAX}
                    </Text>

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={cancelEditing}
                        disabled={saving}
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
                        <Text style={{ fontWeight: "700", fontSize: 14, color: "#E6F3F3" }}>
                          Cancelar
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={{
                          flex: 1,
                          borderRadius: 10,
                          paddingVertical: 12,
                          alignItems: "center",
                          backgroundColor: "#37D6C0",
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>
                          {saving ? "Guardando..." : "Guardar"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {loadError ? <ErrorBox text={loadError} /> : null}

                    {/* Identity */}
                    <View style={{ alignItems: "center", marginBottom: 20 }}>
                      <Text style={{ color: "#F2FAFA", fontSize: 21, fontWeight: "800", letterSpacing: -0.3 }}>
                        {display.name}
                      </Text>
                      <Text style={{ color: "#8DA8AC", fontSize: 13, marginTop: 3 }}>
                        {display.email}
                      </Text>
                    </View>

                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 18 }} />

                    <InfoRow
                      label="Bio"
                      value={display.bio ? display.bio : "Sin descripción"}
                      muted={!display.bio}
                    />
                    {memberSince ? <InfoRow label="Miembro desde" value={memberSince} muted /> : null}

                    <TouchableOpacity
                      onPress={startEditing}
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        paddingVertical: 12,
                        alignItems: "center",
                        marginTop: 4,
                        backgroundColor: "#37D6C0",
                      }}
                    >
                      <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>
                        Editar perfil
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
