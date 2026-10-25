import { useEffect, useState } from "react"
import { View, Text, ScrollView, ActivityIndicator } from "react-native"
import type { ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { ServerRole } from "@/api/types"
import ModalShell from "./ModalShell"
import PressableScale from "./PressableScale"

interface MemberRolesModalProps {
  visible: boolean
  memberName: string
  // Every role the server has, rendered as a checkbox list.
  roles: ServerRole[]
  // Ids of the roles the member already has, loaded via getMemberRoles. Used to
  // pre-check the boxes once they arrive.
  assignedRoleIds: string[]
  loading?: boolean
  error?: string
  // The role whose checkbox is mid-request, so just that row disables.
  busyRoleId?: string
  onClose: () => void
  // HU-3: toggles a role for the member. `assign` is true when checking the box
  // (assignRoleToMember) and false when unchecking (removeRoleFromMember).
  // Resolves true on success so the optimistic state stays; false (403/other)
  // so the checkbox reverts to its previous state.
  onToggle: (role: ServerRole, assign: boolean) => Promise<boolean>
}

// HU-3: role assignment selector — lists every server role as a checkbox, with
// the member's current roles pre-checked. The parent gates visibility to admins
// (the same condition that shows the Roles shield icon) and owns the list, the
// loaded assignments and the API calls. Toggling is optimistic: the checkbox
// flips immediately, then reverts if the parent's call fails (surfaced via
// `error`). Member permissions are the backend-computed union of their roles, so
// nothing is computed here.
export default function MemberRolesModal({
  visible,
  memberName,
  roles,
  assignedRoleIds,
  loading = false,
  error = "",
  busyRoleId = "",
  onClose,
  onToggle,
}: MemberRolesModalProps) {
  // Local display copy of the checked set, seeded from the loaded assignments so
  // toggling starts from the member's real state and can revert without a reload.
  const [assigned, setAssigned] = useState<string[]>(assignedRoleIds)

  useEffect(() => {
    setAssigned(assignedRoleIds)
  }, [assignedRoleIds])

  useEffect(() => {
    if (!visible) setAssigned([])
  }, [visible])

  const handleToggle = async (role: ServerRole) => {
    const wasAssigned = assigned.includes(role.id)
    const assign = !wasAssigned
    // Optimistic: flip the checkbox right away, no screen reload.
    setAssigned((prev) => (assign ? [...prev, role.id] : prev.filter((id) => id !== role.id)))
    const ok = await onToggle(role, assign)
    if (!ok) {
      // Revert to the previous state on any failure (e.g. 403).
      setAssigned((prev) => (assign ? prev.filter((id) => id !== role.id) : [...prev, role.id]))
    }
  }

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Roles del miembro"
      subtitle={`Asigná o quitá roles a ${memberName || "este miembro"}. Sus permisos son la unión de todos sus roles.`}
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
            const checked = assigned.includes(role.id)
            const busy = busyRoleId === role.id
            return (
              <PressableScale
                key={role.id}
                onPress={() => handleToggle(role)}
                disabled={busy}
                pressedScale={1}
                accessibilityLabel={`${checked ? "Quitar" : "Asignar"} el rol ${role.name}`}
                hoverStyle={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                style={ROLE_ROW}
              >
                {busy ? (
                  <ActivityIndicator color="#37D6C0" size="small" style={{ width: 18 }} />
                ) : (
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={18}
                    color={checked ? "#37D6C0" : "#5E7E82"}
                  />
                )}
                <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: "600" }} numberOfLines={1}>
                  {role.name}
                </Text>
              </PressableScale>
            )
          })}
        </ScrollView>
      )}
    </ModalShell>
  )
}

const ROLE_ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  paddingVertical: 10,
  paddingHorizontal: 4,
  borderRadius: 8,
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
