import { useEffect, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import { getUserById } from "@/api/auth"
import { ApiError, friendlyError } from "@/api/client"
import Avatar from "@/components/Avatar"
import type { PublicUser } from "@/api/types"

const CARD_BG = "#0B1822"

const labelStyle = {
  color: "#8DA8AC",
  fontSize: 10,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
  marginBottom: 4,
}

// InfoRow: a labelled read-only value, mirroring the profile summary view.
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

// Initials for the fallback avatar: first letter of up to 2 words.
function initialsFor(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
  return letters || "?"
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [profile, setProfile] = useState<PublicUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState("")

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/(main)/chat")
  }

  useEffect(() => {
    // Viewing your own id -> send to the editable profile screen instead.
    if (id && user?.id && id === user.id) {
      router.replace("/profile")
      return
    }

    let active = true
    setLoading(true)
    setNotFound(false)
    setLoadError("")
    ;(async () => {
      try {
        const data = await getUserById(String(id))
        if (!active) return
        setProfile(data)
      } catch (err) {
        if (!active) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setLoadError(friendlyError(err))
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1620" }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
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
                  Cargando perfil...
                </Text>
              </View>
            ) : notFound || !profile ? (
              // Clean empty state: the user doesn't exist (404) or couldn't load.
              <View style={{ alignItems: "center", paddingTop: 34, paddingBottom: 10, gap: 10 }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 9999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <Ionicons name="person-outline" size={26} color="#5E7E82" />
                </View>
                <Text style={{ color: "#E6F3F3", fontSize: 15, fontWeight: "700", textAlign: "center" }}>
                  Usuario no disponible
                </Text>
                <Text style={{ color: "#8DA8AC", fontSize: 12.5, textAlign: "center", lineHeight: 18, maxWidth: 300 }}>
                  {loadError || "No encontramos este usuario. Puede que ya no exista."}
                </Text>
              </View>
            ) : (
              <>
                {/* Avatar overlapping the banner (read-only: no camera badge) */}
                <View style={{ alignItems: "center", marginTop: -46, marginBottom: 14 }}>
                  <View style={{ borderRadius: 9999, borderWidth: 4, borderColor: CARD_BG }}>
                    <Avatar initials={initialsFor(profile.name)} size={92} uri={profile.avatarUrl} />
                  </View>
                </View>

                {/* Identity (no email: public profiles carry no private data) */}
                <View style={{ alignItems: "center", marginBottom: 20 }}>
                  <Text style={{ color: "#F2FAFA", fontSize: 21, fontWeight: "800", letterSpacing: -0.3 }}>
                    {profile.name}
                  </Text>
                </View>

                <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 18 }} />

                <InfoRow
                  label="Bio"
                  value={profile.bio ? profile.bio : "Sin descripción"}
                  muted={!profile.bio}
                />
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
