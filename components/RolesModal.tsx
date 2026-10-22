import { View, Text, ScrollView, ActivityIndicator } from "react-native"
import type { ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ADMIN_PERMISSION } from "@/api"
import type { ServerRole } from "@/api/types"
import ModalShell from "./ModalShell"
import PressableScale from "./PressableScale"

interface RolesModalProps {
  visible: boolean
  roles: ServerRole[]
  defaultRoleId?: string | null
  loading?: boolean
  error?: string
  busyRoleId?: string
  onClose: () => void
  onDelete: (role: ServerRole) => void
}

// HU-5 (#92): role manager — lists a server's roles and lets an admin delete
// one. The parent gates visibility to admins (CA2) and owns the list + the API
// call. Deletion is blocked in the UI for roles the backend rejects with 409:
// the default role, and any `administrator` role (which the caller likely holds
// themselves). A 403/409 that still slips through is surfaced via `error`.
export default function RolesModal({
  visible,
  roles,
  defaultRoleId = null,
  loading = false,
  error = "",
  busyRoleId = "",
  onClose,
  onDelete,
}: RolesModalProps) {
  // Why a role can't be deleted, or "" when it can. Mirrors the backend's 409.
  const blockedReason = (role: ServerRole): string => {
    if (role.id === defaultRoleId) return "Rol por defecto"
    if (role.permissions.includes(ADMIN_PERMISSION)) return "Rol de administración"
    return ""
  }

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Roles del servidor"
      subtitle="Eliminá un rol. Los miembros que lo tengan pierden sus permisos."
    >
      {error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 28, alignItems: "center" }}>
          <ActivityIndicator color="#37D6C0" />
        </View>
      ) : roles.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <Text style={{ color: "#5E7E82", fontSize: 13 }}>Este servidor no tiene roles.</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 320 }}>
          {roles.map((role) => {
            const reason = blockedReason(role)
            const busy = busyRoleId === role.id
            return (
              <View key={role.id} style={ROW}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#E6F3F3", fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                    {role.name}
                  </Text>
                  <Text style={{ color: "#8DA8AC", fontSize: 11, marginTop: 2 }}>
                    {reason
                      ? reason
                      : `${role.permissions.length} ${role.permissions.length === 1 ? "permiso" : "permisos"}`}
                  </Text>
                </View>
                <PressableScale
                  onPress={() => onDelete(role)}
                  disabled={reason !== "" || busy}
                  accessibilityLabel={`Eliminar rol ${role.name}`}
                  hoverStyle={reason ? undefined : { backgroundColor: "rgba(255,127,114,0.22)" }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,127,114,0.12)",
                    opacity: reason !== "" ? 0.35 : 1,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color="#FF7F72" size="small" />
                  ) : (
                    <Ionicons name="trash-outline" size={16} color="#FF7F72" />
                  )}
                </PressableScale>
              </View>
            )
          })}
        </ScrollView>
      )}
    </ModalShell>
  )
}

const ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255,255,255,0.08)",
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
