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
        padding: 10,
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: "rgba(255,127,114,0.15)",
        borderWidth: 1,
        borderColor: "#FF7F72",
      }}
    >
      <Text style={{ color: "#FF7F72", fontWeight: "700" }}>!</Text>
      <Text style={{ color: "#FF7F72", fontSize: 12, flex: 1 }}>{text}</Text>
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
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: "#E6F3F3",
  fontSize: 14,
  backgroundColor: "rgba(255,255,255,0.10)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.13)",
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
          <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 16 }}>
            Mi perfil
          </Text>

          {loading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color="#37D6C0" />
              <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 12 }}>
                Cargando tu perfil...
              </Text>
            </View>
          ) : (
            <>
              {loadError ? <ErrorBox text={loadError} /> : null}

              {display ? (
                <>
                  {/* Avatar */}
                  <View style={{ alignItems: "center", marginBottom: 20 }}>
                    <Avatar
                      initials={display.avatar}
                      size={88}
                      uri={display.avatarUrl}
                    />
                    <TouchableOpacity
                      onPress={handleChangePhoto}
                      disabled={avatarLoading}
                      style={{
                        marginTop: 12,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.13)",
                        backgroundColor: "rgba(255,255,255,0.10)",
                      }}
                    >
                      <Text style={{ color: "#E6F3F3", fontSize: 12, fontWeight: "600" }}>
                        {avatarLoading ? "Subiendo..." : "Cambiar foto"}
                      </Text>
                    </TouchableOpacity>
                    {avatarError ? (
                      <View style={{ marginTop: 12, width: "100%" }}>
                        <ErrorBox text={avatarError} />
                      </View>
                    ) : null}
                  </View>

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
                        style={{ ...inputStyle, marginBottom: 12 }}
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
                      <Text style={{ color: "#5E7E82", fontSize: 10, textAlign: "right", marginBottom: 16 }}>
                        {bio.length}/{BIO_MAX}
                      </Text>

                      <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          paddingVertical: 12,
                          alignItems: "center",
                          backgroundColor: "#37D6C0",
                        }}
                      >
                        <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>
                          {saving ? "Guardando..." : "Guardar"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={cancelEditing}
                        disabled={saving}
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          paddingVertical: 12,
                          alignItems: "center",
                          marginTop: 8,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.13)",
                        }}
                      >
                        <Text style={{ fontWeight: "600", fontSize: 14, color: "#8DA8AC" }}>
                          Cancelar
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={labelStyle}>Nombre</Text>
                      <Text style={{ color: "#E6F3F3", fontSize: 16, fontWeight: "700", marginBottom: 12 }}>
                        {display.name}
                      </Text>

                      <Text style={labelStyle}>Correo electrónico</Text>
                      <Text style={{ color: "#E6F3F3", fontSize: 14, marginBottom: 12 }}>
                        {display.email}
                      </Text>

                      <Text style={labelStyle}>Bio</Text>
                      <Text
                        style={{
                          color: display.bio ? "#E6F3F3" : "#5E7E82",
                          fontSize: 14,
                          fontStyle: display.bio ? "normal" : "italic",
                          marginBottom: 12,
                          lineHeight: 20,
                        }}
                      >
                        {display.bio ? display.bio : "Sin descripción"}
                      </Text>

                      {memberSince ? (
                        <>
                          <Text style={labelStyle}>Miembro desde</Text>
                          <Text style={{ color: "#8DA8AC", fontSize: 13, marginBottom: 16 }}>
                            {memberSince}
                          </Text>
                        </>
                      ) : null}

                      <TouchableOpacity
                        onPress={startEditing}
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          paddingVertical: 12,
                          alignItems: "center",
                          backgroundColor: "#37D6C0",
                        }}
                      >
                        <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>
                          Editar
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : (
                <Text style={{ color: "#8DA8AC", fontSize: 13 }}>
                  No encontramos tus datos de perfil.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
