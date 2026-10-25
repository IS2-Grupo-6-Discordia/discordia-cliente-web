import { useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"

const MENU_SURFACE = "#0F1C25"
const MENU_WIDTH = 220
// Rough height of one row, to flip the menu above the trigger near the bottom.
const ROW_HEIGHT = 40

type IoniconName = React.ComponentProps<typeof Ionicons>["name"]

export interface MemberAction {
  key: string
  label: string
  icon: IoniconName
  tone?: "default" | "danger"
  onPress: () => void
}

// The "⋮" button on a member row and the dropdown it opens. Same look and
// behavior as UserMenu (anchored Modal, Escape / tap outside closes), so every
// per-member action (transfer, ban and, later, roles) lives in one place.
export default function MemberActionsMenu({
  memberName,
  actions,
}: {
  memberName: string
  actions: MemberAction[]
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const triggerRef = useRef<View>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ top: 0, right: 12 })
  const [reduceMotion, setReduceMotion] = useState(false)
  const progress = useRef(new Animated.Value(0)).current

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
      duration: reduceMotion ? 0 : 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start()
  }, [open, reduceMotion, progress])

  useEffect(() => {
    if (!open || Platform.OS !== "web") return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const menuHeight = actions.length * ROW_HEIGHT + 12
      const below = y + height + 6
      const top = below + menuHeight > windowHeight - 8 ? Math.max(8, y - menuHeight - 6) : below
      setAnchor({ top, right: Math.max(8, windowWidth - (x + width)) })
      setOpen(true)
    })
  }

  const choose = (action: MemberAction) => {
    setOpen(false)
    action.onPress()
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={(e) => {
          // The row itself opens the profile: keep this press to the menu.
          e.stopPropagation()
          openMenu()
        }}
        accessibilityRole="button"
        accessibilityLabel={`Opciones de ${memberName}`}
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
          width: 28,
          height: 28,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: open || pressed
            ? "rgba(55,214,192,0.16)"
            : hovered
              ? "rgba(255,255,255,0.08)"
              : "transparent",
        })}
      >
        <Ionicons name="ellipsis-vertical" size={15} color={open ? "#37D6C0" : "#8DA8AC"} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
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
              borderRadius: 12,
              backgroundColor: MENU_SURFACE,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              opacity: progress,
              transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
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
            {actions.map((action) => {
              const danger = action.tone === "danger"
              const color = danger ? "#FF8A80" : "#E6F3F3"
              return (
                <Pressable
                  key={action.key}
                  onPress={() => choose(action)}
                  accessibilityRole="menuitem"
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: pressed
                      ? danger
                        ? "rgba(255,138,128,0.16)"
                        : "rgba(55,214,192,0.16)"
                      : hovered
                        ? danger
                          ? "rgba(255,138,128,0.10)"
                          : "rgba(255,255,255,0.06)"
                        : "transparent",
                  })}
                >
                  <Ionicons name={action.icon} size={16} color={danger ? color : "#8DA8AC"} />
                  <Text style={{ color, fontSize: 13.5, fontWeight: "600", flex: 1 }}>{action.label}</Text>
                </Pressable>
              )
            })}
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  )
}
