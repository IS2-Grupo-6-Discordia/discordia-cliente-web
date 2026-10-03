import { useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import { updateProfile } from "@/api/auth"
import { friendlyError } from "@/api/client"
import Avatar from "@/components/Avatar"
import { PresenceDot, STATUS_LABELS } from "@/components/StatusDot"
import type { UserStatus } from "@/api/types"

const HEADER_SURFACE = "#17232C"
const MENU_SURFACE = "#0F1C25"
const MENU_WIDTH = 264

const STATUS_OPTIONS: { value: UserStatus; label: string; hint?: string }[] = [
  { value: "online", label: STATUS_LABELS.online },
  { value: "away", label: STATUS_LABELS.away },
  { value: "dnd", label: STATUS_LABELS.dnd },
  { value: "invisible", label: "Invisible", hint: "Los demás te ven desconectado/a" },
]

function statusLabel(status: UserStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? STATUS_LABELS.online
}

type IoniconName = React.ComponentProps<typeof Ionicons>["name"]

function MenuRow({
  icon,
  leading,
  label,
  onPress,
  tone = "default",
  trailing,
  expanded,
}: {
  icon?: IoniconName
  leading?: React.ReactNode
  label: string
  onPress: () => void
  tone?: "default" | "danger"
  trailing?: React.ReactNode
  expanded?: boolean
}) {
  const color = tone === "danger" ? "#FF8A80" : "#E6F3F3"
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: pressed
          ? tone === "danger"
            ? "rgba(255,138,128,0.16)"
            : "rgba(55,214,192,0.16)"
          : hovered
            ? tone === "danger"
              ? "rgba(255,138,128,0.10)"
              : "rgba(255,255,255,0.06)"
            : "transparent",
      })}
    >
      {leading}
      {icon ? <Ionicons name={icon} size={17} color={tone === "danger" ? color : "#8DA8AC"} /> : null}
      <Text style={{ color, fontSize: 14, fontWeight: "600", flex: 1 }}>{label}</Text>
      {trailing}
    </Pressable>
  )
}

export default function UserMenu() {
  const { user, setUser, logout } = useAuth()
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()
  const triggerRef = useRef<View>(null)

  const [open, setOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [anchor, setAnchor] = useState({ top: 56, right: 12 })
  const [saving, setSaving] = useState<UserStatus | null>(null)
  const [error, setError] = useState("")
  const [reduceMotion, setReduceMotion] = useState(false)
  const progress = useRef(new Animated.Value(0)).current

  const status: UserStatus = user?.status ?? "online"

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start()
  }, [open, reduceMotion, progress])

  useEffect(() => {
    if (!open || Platform.OS !== "web") return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const openMenu = () => {
    setError("")
    setStatusOpen(false)
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ top: y + height + 8, right: Math.max(8, windowWidth - (x + width)) })
      setOpen(true)
    })
  }

  const close = () => {
    setOpen(false)
    setStatusOpen(false)
  }

  const goToProfile = () => {
    close()
    router.push("/(main)/profile")
  }

  const handleLogout = () => {
    close()
    logout()
  }

  const chooseStatus = async (next: UserStatus) => {
    if (saving) return
    if (next === status) {
      setStatusOpen(false)
      return
    }
    setSaving(next)
    setError("")
    try {
      const updated = await updateProfile({ status: next })
      setUser(updated)
      setStatusOpen(false)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={`Menú de cuenta. Estado: ${statusLabel(status)}`}
        accessibilityState={{ expanded: open }}
        style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 4,
          paddingLeft: 4,
          paddingRight: 8,
          borderRadius: 9999,
          backgroundColor: open || pressed
            ? "rgba(55,214,192,0.14)"
            : hovered
              ? "rgba(255,255,255,0.06)"
              : "transparent",
        })}
      >
        <View>
          <Avatar initials={user?.avatar ?? "?"} size={30} uri={user?.avatarUrl} />
          <View style={{ position: "absolute", bottom: -2, left: -2 }}>
            <PresenceDot status={status} size={10} ringColor={HEADER_SURFACE} />
          </View>
        </View>
        <Text style={{ color: "#E6F3F3", fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
          {user?.name}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color="#8DA8AC" />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={close}>
        <Pressable
          onPress={close}
          accessibilityLabel="Cerrar menú"
          style={{ flex: 1, ...(Platform.OS === "web" ? ({ cursor: "default" } as object) : {}) }}
        >
          <Animated.View
            accessibilityRole="menu"
            onStartShouldSetResponder={() => true}
            style={{
              position: "absolute",
              top: anchor.top,
              right: anchor.right,
              width: Math.min(MENU_WIDTH, windowWidth - 16),
              padding: 6,
              borderRadius: 14,
              backgroundColor: MENU_SURFACE,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              opacity: progress,
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
              ...(Platform.OS === "web"
                ? ({ boxShadow: "0 18px 48px -12px rgba(0,0,0,0.75)", transformOrigin: "top right" } as object)
                : {
                    shadowColor: "#000",
                    shadowOpacity: 0.5,
                    shadowRadius: 24,
                    shadowOffset: { width: 0, height: 12 },
                    elevation: 12,
                  }),
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10 }}>
              <View>
                <Avatar initials={user?.avatar ?? "?"} size={42} uri={user?.avatarUrl} />
                <View style={{ position: "absolute", bottom: -1, left: -1 }}>
                  <PresenceDot status={status} size={12} ringColor={MENU_SURFACE} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#F2FAFA", fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
                  {user?.name}
                </Text>
                <Text style={{ color: "#8DA8AC", fontSize: 12.5, marginTop: 2 }}>{statusLabel(status)}</Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 4 }} />

            <MenuRow icon="person-outline" label="Perfil" onPress={goToProfile} />
            <MenuRow
              label="Cambiar estado"
              onPress={() => setStatusOpen((value) => !value)}
              expanded={statusOpen}
              trailing={
                <Ionicons name={statusOpen ? "chevron-up" : "chevron-down"} size={15} color="#8DA8AC" />
              }
              leading={
                <View style={{ width: 17, alignItems: "center" }}>
                  <PresenceDot status={status} size={11} ringColor={MENU_SURFACE} />
                </View>
              }
            />

            {statusOpen ? (
              <View style={{ paddingLeft: 8, paddingBottom: 2 }}>
                {STATUS_OPTIONS.map((option) => {
                  const selected = option.value === status
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => chooseStatus(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, busy: saving === option.value }}
                      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: pressed
                          ? "rgba(55,214,192,0.16)"
                          : hovered
                            ? "rgba(255,255,255,0.06)"
                            : "transparent",
                      })}
                    >
                      <PresenceDot status={option.value} size={10} ringColor={MENU_SURFACE} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: selected ? "700" : "500" }}>
                          {option.label}
                        </Text>
                        {option.hint ? (
                          <Text style={{ color: "#8DA8AC", fontSize: 11.5, marginTop: 1 }}>{option.hint}</Text>
                        ) : null}
                      </View>
                      {saving === option.value ? (
                        <ActivityIndicator size="small" color="#37D6C0" />
                      ) : selected ? (
                        <Ionicons name="checkmark" size={16} color="#37D6C0" />
                      ) : null}
                    </Pressable>
                  )
                })}
                {error ? (
                  <Text style={{ color: "#FF8A80", fontSize: 12, paddingHorizontal: 10, paddingTop: 4 }}>
                    {error}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 4 }} />

            <MenuRow icon="log-out-outline" label="Cerrar sesión" onPress={handleLogout} tone="danger" />
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  )
}
