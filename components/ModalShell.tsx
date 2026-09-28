import type { ReactNode } from "react"
import { View, Text, TouchableOpacity, Modal, Platform } from "react-native"

interface ModalShellProps {
  visible: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  maxWidth?: number
}

// Shared dialog frame for every modal in the app: a dimmed backdrop, a single
// card with a title / optional subtitle, and a corner close button. Centralizing
// it keeps the modals visually consistent and cuts the duplicated boilerplate.
export default function ModalShell({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 380,
}: ModalShellProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(3,10,14,0.72)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          ...(Platform.OS === "web" ? ({ backdropFilter: "blur(6px)" } as object) : {}),
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth,
            borderRadius: 16,
            padding: 22,
            backgroundColor: "#0B1822",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            ...(Platform.OS === "web"
              ? ({ boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)" } as object)
              : { shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } }),
          }}
        >
          {/* Header: title + optional subtitle, close button pinned top-right */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: subtitle ? 4 : 18 }}>
            <Text style={{ flex: 1, color: "#F2FAFA", fontWeight: "800", fontSize: 17, letterSpacing: -0.2 }}>
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Cerrar"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                marginTop: -2,
                marginRight: -4,
              }}
            >
              <Text style={{ color: "#8DA8AC", fontSize: 18, lineHeight: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
          {subtitle ? (
            <Text style={{ color: "#8DA8AC", fontSize: 12.5, lineHeight: 17, marginBottom: 18 }}>
              {subtitle}
            </Text>
          ) : null}

          {children}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
