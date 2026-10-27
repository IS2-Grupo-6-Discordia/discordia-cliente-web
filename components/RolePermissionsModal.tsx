import { useEffect, useState } from "react"
import { View, Text, ScrollView, ActivityIndicator } from "react-native"
import type { ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ADMIN_PERMISSION } from "@/api"
import type { ServerRole } from "@/api/types"
import ModalShell from "./ModalShell"
import PressableScale from "./PressableScale"

// HU-2: the backend's permission vocabulary (lowercase) paired with the Spanish
// label each toggle shows. Order is fixed so the editor always reads the same.
// Single source of truth for the permission checklist, consumed here (RolesModal
// no longer edits permissions inline).
export const PERMISSION_OPTIONS: { key: string; label: string }[] = [
  { key: "administrator", label: "Administrador" },
  { key: "manage_server", label: "Gestionar servidor" },
  { key: "manage_roles", label: "Gestionar roles" },
  { key: "manage_channels", label: "Gestionar canales" },
  { key: "create_invite", label: "Crear invitaciones" },
  { key: "kick_members", label: "Expulsar miembros" },
  { key: "ban_members", label: "Banear miembros" },
  { key: "send_messages", label: "Enviar mensajes" },
  { key: "connect_voice", label: "Conectarse a voz" },
  { key: "add_reactions", label: "Agregar reacciones" },
]

interface RolePermissionsModalProps {
  visible: boolean
  roleName: string
  role: ServerRole | null
  busy?: boolean
  error?: string
  onClose: () => void
  // HU-2: replace a role's permission mask with the COMPLETE checked list.
  // Resolves true on success so the modal can close; false (403/409/422) keeps
  // it open and the draft reverts to the role's current permissions (the parent
  // surfaces the reason via `error`).
  onSave: (role: ServerRole, permissions: string[]) => Promise<boolean>
}

// HU-2 (drill-in): dedicated permission editor for a single role, mirroring
// MemberRolesModal / RoleMembersModal. The parent (chat.tsx) gates visibility to
// managers and owns the API call + busy/error state; this component only renders
// the checklist and drives a local draft until saved. Opened from the role row's
// chevron in RolesModal, replacing the old inline accordion.
export default function RolePermissionsModal({
  visible,
  roleName,
  role,
  busy = false,
  error = "",
  onClose,
  onSave,
}: RolePermissionsModalProps) {
  // Working copy of the checked permissions, seeded from the role's current
  // permissions so toggling starts from its real state and can revert on failure.
  const [draft, setDraft] = useState<string[]>([])

  // Re-seed whenever the modal opens or the target role changes; clear on close.
  useEffect(() => {
    if (visible && role) {
      setDraft([...role.permissions])
    } else if (!visible) {
      setDraft([])
    }
  }, [visible, role])

  // Administrator is a wildcard: the backend reads it as "every permission", so
  // when it's checked we SHOW the other toggles as on and locked. This is purely
  // visual — the draft is never mutated, so Save still sends only what the user
  // really picked plus "administrator" (never the eight individual permissions).
  const adminOn = draft.includes(ADMIN_PERMISSION)

  const togglePerm = (key: string) => {
    setDraft((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]))
  }

  // Save sends the COMPLETE checked list. On success the modal closes; on any
  // failure the draft reverts to the role's state (the parent surfaced the
  // reason via `error`) and the modal stays open.
  const handleSave = async () => {
    if (!role) return
    const ok = await onSave(role, draft)
    if (ok) {
      onClose()
    } else {
      setDraft([...role.permissions])
    }
  }

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title={`Permisos de "${roleName || "este rol"}"`}
      subtitle="Elegí qué puede hacer este rol. Los cambios se aplican a todos los miembros que lo tengan."
    >
      {error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      <ScrollView style={{ maxHeight: 320 }}>
        {PERMISSION_OPTIONS.map((perm) => {
          // Every permission other than Administrator itself is implied while
          // Administrator is on: shown checked and locked, but left out of the draft.
          const impliedByAdmin = adminOn && perm.key !== ADMIN_PERMISSION
          const checked = impliedByAdmin || draft.includes(perm.key)
          const locked = busy || impliedByAdmin
          return (
            <PressableScale
              key={perm.key}
              onPress={() => togglePerm(perm.key)}
              disabled={locked}
              pressedScale={1}
              accessibilityLabel={
                impliedByAdmin
                  ? `${perm.label}: incluido por Administrador`
                  : `${checked ? "Quitar" : "Agregar"} permiso ${perm.label}`
              }
              hoverStyle={locked ? undefined : { backgroundColor: "rgba(255,255,255,0.04)" }}
              style={{ ...PERM_ROW, opacity: impliedByAdmin ? 0.6 : 1 }}
            >
              <Ionicons
                name={checked ? "checkbox" : "square-outline"}
                size={18}
                color={checked ? "#37D6C0" : "#5E7E82"}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#E6F3F3", fontSize: 13.5 }}>{perm.label}</Text>
                {impliedByAdmin ? (
                  <Text style={{ color: "#5E7E82", fontSize: 11, marginTop: 2 }}>
                    Incluido por Administrador
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          )
        })}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <PressableScale
          onPress={handleSave}
          disabled={busy || !role}
          accessibilityLabel="Guardar permisos"
          style={{ ...PRIMARY_BTN, opacity: busy || !role ? 0.6 : 1 }}
        >
          {busy ? (
            <ActivityIndicator color="#04211D" size="small" />
          ) : (
            <Text style={PRIMARY_TXT}>Guardar</Text>
          )}
        </PressableScale>
        <PressableScale
          onPress={onClose}
          disabled={busy}
          accessibilityLabel="Cancelar edición de permisos"
          hoverStyle={{ backgroundColor: "rgba(255,255,255,0.08)" }}
          style={SECONDARY_BTN}
        >
          <Text style={{ color: "#8DA8AC", fontSize: 14, fontWeight: "600" }}>Cancelar</Text>
        </PressableScale>
      </View>
    </ModalShell>
  )
}

const PERM_ROW: ViewStyle = {
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
const PRIMARY_BTN: ViewStyle = {
  flex: 1,
  borderRadius: 10,
  paddingVertical: 12,
  alignItems: "center",
  backgroundColor: "#37D6C0",
}
const PRIMARY_TXT = { fontWeight: "700" as const, fontSize: 14, color: "#04211D" }
const SECONDARY_BTN: ViewStyle = {
  borderRadius: 10,
  paddingVertical: 12,
  paddingHorizontal: 18,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.05)",
}
