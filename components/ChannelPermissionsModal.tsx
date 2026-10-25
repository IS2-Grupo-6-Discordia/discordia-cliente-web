import { useEffect, useState } from "react"
import { View, Text, ScrollView, ActivityIndicator } from "react-native"
import type { ViewStyle, TextStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { ServerRole, ChannelOverwrite } from "@/api/types"
import ModalShell from "./ModalShell"
import PressableScale from "./PressableScale"

// HU-7: the only permissions that can be overridden per channel, paired with the
// Spanish label each row shows. Tokens must match the backend exactly. Order is
// fixed so the editor always reads the same.
const OVERWRITABLE_PERMISSIONS: { key: string; label: string }[] = [
  { key: "send_messages", label: "Enviar mensajes" },
  { key: "connect_voice", label: "Conectarse a voz" },
  { key: "create_invite", label: "Crear invitaciones" },
  { key: "manage_channels", label: "Gestionar canal" },
]

// The three states a permission can hold in a channel overwrite: forced allow,
// forced deny, or inherit (in neither list — the role's server-level default).
type PermState = "allow" | "inherit" | "deny"

interface ChannelPermissionsModalProps {
  visible: boolean
  channelName: string
  // Every role the server has, rendered as an expandable list.
  roles: ServerRole[]
  // The channel's current overwrites, loaded by the parent. A role absent from
  // this list has no overwrite (every permission inherited).
  overwrites: ChannelOverwrite[]
  loading?: boolean
  error?: string
  // The role whose Guardar/Quitar request is mid-flight, so just that row's
  // actions disable.
  busyRoleId?: string
  // Gates the editable list. The parent only opens this from an admin context,
  // but rendering is also guarded here.
  canAdministrate?: boolean
  onClose: () => void
  // HU-7: create/replace a role's overwrite with the COMPLETE allow/deny lists.
  // The backend deletes the overwrite when both are empty. Resolves true on
  // success so the editor collapses; false (403/404/422/other) so it stays open
  // and the draft reverts to the role's loaded state.
  onSave: (role: ServerRole, allow: string[], deny: string[]) => Promise<boolean>
  // HU-7: drop a role's overwrite entirely (back to all-inherit). Resolves true
  // on success so the editor collapses; false so it stays open.
  onRemove: (role: ServerRole) => Promise<boolean>
}

// HU-7: per-channel permission editor — lists every server role; expanding one
// shows the four overwritable permissions, each with a three-state selector
// (Permitir / Heredar / Denegar). The parent gates visibility to admins (the
// same canAdministrate condition that opens it), owns the role list + loaded
// overwrites, and performs the API calls. Saving sends the COMPLETE allow/deny
// lists; on any failure the parent surfaces the reason via `error` and the draft
// reverts to the role's loaded state.
export default function ChannelPermissionsModal({
  visible,
  channelName,
  roles,
  overwrites,
  loading = false,
  error = "",
  busyRoleId = "",
  canAdministrate = false,
  onClose,
  onSave,
  onRemove,
}: ChannelPermissionsModalProps) {
  // The role whose editor is open (one at a time), plus the working copies of its
  // allow/deny lists the selectors mutate until saved, cancelled, or reverted.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftAllow, setDraftAllow] = useState<string[]>([])
  const [draftDeny, setDraftDeny] = useState<string[]>([])

  useEffect(() => {
    if (!visible) {
      setEditingId(null)
      setDraftAllow([])
      setDraftDeny([])
    }
  }, [visible])

  // The overwrite loaded for a role, or an empty one (all-inherit) when none.
  const loadedFor = (roleId: string): ChannelOverwrite =>
    overwrites.find((o) => o.roleId === roleId) ?? { roleId, allow: [], deny: [] }

  // How many permissions a role currently overrides (allow + deny), for the row
  // summary. 0 means it inherits everything.
  const overrideCount = (roleId: string): number => {
    const o = loadedFor(roleId)
    return o.allow.length + o.deny.length
  }

  // Open a role's editor, seeding the draft from its loaded overwrite so toggling
  // starts from the role's real state and can revert without a reload.
  const openEditor = (role: ServerRole) => {
    const o = loadedFor(role.id)
    setEditingId(role.id)
    setDraftAllow([...o.allow])
    setDraftDeny([...o.deny])
  }

  // Cancel discards the draft and collapses the editor without calling the API.
  const cancelEditor = () => {
    setEditingId(null)
    setDraftAllow([])
    setDraftDeny([])
  }

  const stateOf = (key: string): PermState => {
    if (draftAllow.includes(key)) return "allow"
    if (draftDeny.includes(key)) return "deny"
    return "inherit"
  }

  // Move a permission into exactly one state: clear it from both lists first,
  // then add it to the chosen one (inherit leaves it in neither).
  const setPermState = (key: string, next: PermState) => {
    setDraftAllow((prev) => {
      const cleared = prev.filter((p) => p !== key)
      return next === "allow" ? [...cleared, key] : cleared
    })
    setDraftDeny((prev) => {
      const cleared = prev.filter((p) => p !== key)
      return next === "deny" ? [...cleared, key] : cleared
    })
  }

  // Save sends the COMPLETE allow/deny lists. On success the editor collapses; on
  // any error the draft reverts to the role's loaded state (the parent surfaced
  // the reason via `error`).
  const handleSave = async (role: ServerRole) => {
    const ok = await onSave(role, draftAllow, draftDeny)
    if (ok) {
      setEditingId(null)
      setDraftAllow([])
      setDraftDeny([])
    } else {
      const o = loadedFor(role.id)
      setDraftAllow([...o.allow])
      setDraftDeny([...o.deny])
    }
  }

  // Quitar excepción drops the whole overwrite. On success the editor collapses;
  // on error the draft stays as-is (the parent surfaced the reason).
  const handleRemove = async (role: ServerRole) => {
    const ok = await onRemove(role)
    if (ok) {
      setEditingId(null)
      setDraftAllow([])
      setDraftDeny([])
    }
  }

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Permisos por rol"
      subtitle={`Forzá o denegá permisos de cada rol en ${channelName ? `#${channelName}` : "este canal"}. "Heredar" deja el permiso normal del rol.`}
    >
      {error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      {!canAdministrate ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <Text style={{ color: "#5E7E82", fontSize: 13 }}>
            No tenés permisos para configurar este canal.
          </Text>
        </View>
      ) : loading ? (
        <View style={{ paddingVertical: 28, alignItems: "center" }}>
          <ActivityIndicator color="#37D6C0" />
        </View>
      ) : roles.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <Text style={{ color: "#5E7E82", fontSize: 13 }}>Este servidor no tiene roles.</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 360 }}>
          {roles.map((role) => {
            const editing = editingId === role.id
            const busy = busyRoleId === role.id
            const count = overrideCount(role.id)
            return (
              <View key={role.id} style={ROW_WRAP}>
                <View style={ROW}>
                  {/* Tapping the role opens/closes its overwrite editor. */}
                  <PressableScale
                    onPress={() => (editing ? cancelEditor() : openEditor(role))}
                    pressedScale={1}
                    accessibilityLabel={`Editar permisos del rol ${role.name} en el canal`}
                    hoverStyle={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <Ionicons
                      name={editing ? "chevron-down" : "chevron-forward"}
                      size={14}
                      color="#5E7E82"
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ color: "#E6F3F3", fontSize: 14, fontWeight: "600" }}
                        numberOfLines={1}
                      >
                        {role.name}
                      </Text>
                      <Text style={{ color: "#8DA8AC", fontSize: 11, marginTop: 2 }}>
                        {count === 0
                          ? "Sin excepciones"
                          : `${count} ${count === 1 ? "excepción" : "excepciones"}`}
                      </Text>
                    </View>
                  </PressableScale>
                </View>

                {/* Three-state selectors for the open role's four permissions. */}
                {editing ? (
                  <View style={{ paddingBottom: 12, gap: 8 }}>
                    {OVERWRITABLE_PERMISSIONS.map((perm) => {
                      const current = stateOf(perm.key)
                      return (
                        <View key={perm.key} style={{ gap: 6 }}>
                          <Text style={{ color: "#E6F3F3", fontSize: 13 }}>{perm.label}</Text>
                          <View style={SEGMENT}>
                            {SEGMENTS.map((seg) => {
                              const active = current === seg.value
                              return (
                                <PressableScale
                                  key={seg.value}
                                  onPress={() => setPermState(perm.key, seg.value)}
                                  disabled={busy}
                                  pressedScale={1}
                                  accessibilityLabel={`${seg.label} ${perm.label} para el rol ${role.name}`}
                                  hoverStyle={active ? undefined : { backgroundColor: "rgba(255,255,255,0.04)" }}
                                  style={{
                                    ...SEGMENT_BTN,
                                    backgroundColor: active ? seg.activeBg : "transparent",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: active ? seg.activeColor : "#8DA8AC",
                                      fontSize: 12.5,
                                      fontWeight: active ? "700" : "600",
                                    }}
                                  >
                                    {seg.label}
                                  </Text>
                                </PressableScale>
                              )
                            })}
                          </View>
                        </View>
                      )
                    })}

                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                      <PressableScale
                        onPress={() => handleSave(role)}
                        disabled={busy}
                        accessibilityLabel="Guardar los permisos del canal"
                        style={{ ...PRIMARY_BTN, opacity: busy ? 0.6 : 1 }}
                      >
                        {busy ? (
                          <ActivityIndicator color="#04211D" size="small" />
                        ) : (
                          <Text style={PRIMARY_TXT}>Guardar</Text>
                        )}
                      </PressableScale>
                      <PressableScale
                        onPress={cancelEditor}
                        disabled={busy}
                        accessibilityLabel="Cancelar la edición de permisos del canal"
                        hoverStyle={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                        style={SECONDARY_BTN}
                      >
                        <Text style={{ color: "#8DA8AC", fontSize: 14, fontWeight: "600" }}>
                          Cancelar
                        </Text>
                      </PressableScale>
                    </View>

                    {/* Quitar excepción: drop the overwrite entirely. Only shown
                        when the role actually has one to remove. */}
                    {count > 0 ? (
                      <PressableScale
                        onPress={() => handleRemove(role)}
                        disabled={busy}
                        accessibilityLabel={`Quitar la excepción del rol ${role.name} en el canal`}
                        hoverStyle={{ backgroundColor: "rgba(255,127,114,0.22)" }}
                        style={{ ...REMOVE_BTN, opacity: busy ? 0.6 : 1 }}
                      >
                        <Ionicons name="close-circle-outline" size={15} color="#FF7F72" />
                        <Text style={{ color: "#FF7F72", fontSize: 12.5, fontWeight: "700" }}>
                          Quitar excepción
                        </Text>
                      </PressableScale>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          })}
        </ScrollView>
      )}
    </ModalShell>
  )
}

// The three selector segments, with their active colors.
const SEGMENTS: { value: PermState; label: string; activeBg: string; activeColor: string }[] = [
  { value: "allow", label: "Permitir", activeBg: "rgba(79,214,156,0.18)", activeColor: "#4FD69C" },
  { value: "inherit", label: "Heredar", activeBg: "rgba(255,255,255,0.10)", activeColor: "#E6F3F3" },
  { value: "deny", label: "Denegar", activeBg: "rgba(255,127,114,0.18)", activeColor: "#FF7F72" },
]

const ROW_WRAP: ViewStyle = {
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255,255,255,0.08)",
}
const ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  paddingVertical: 10,
}
const SEGMENT: ViewStyle = {
  flexDirection: "row",
  gap: 4,
  padding: 3,
  borderRadius: 10,
  backgroundColor: "rgba(255,255,255,0.05)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
}
const SEGMENT_BTN: ViewStyle = {
  flex: 1,
  paddingVertical: 8,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
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
const PRIMARY_TXT: TextStyle = { fontWeight: "700", fontSize: 14, color: "#04211D" }
const SECONDARY_BTN: ViewStyle = {
  borderRadius: 10,
  paddingVertical: 12,
  paddingHorizontal: 18,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.05)",
}
const REMOVE_BTN: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: "rgba(255,127,114,0.12)",
}
