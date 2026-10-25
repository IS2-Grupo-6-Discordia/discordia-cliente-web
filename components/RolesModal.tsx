import { useEffect, useState } from "react"
import { View, Text, TextInput, ScrollView, ActivityIndicator } from "react-native"
import type { ViewStyle, TextStyle } from "react-native"
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
  // HU-4: the role whose "Marcar como por defecto" action is mid-request.
  defaultBusyId?: string
  // HU-4: whether the current user can manage roles. Reuses the parent's
  // `canAdministrate` memo so the set-default action never invents its own check.
  canAdministrate?: boolean
  createBusy?: boolean
  updateBusy?: boolean
  // HU-6: the "Guardar orden" request is in flight.
  reorderBusy?: boolean
  // HU-6 (CA2): hierarchy helper. The owner is exempt (no restriction);
  // `ownRolePosition` is the current user's own position (lowest position number
  // = highest in the hierarchy) among their non-default roles, or null when they
  // hold none. Used to disable arrows for roles at the user's level or above.
  isOwner?: boolean
  ownRolePosition?: number | null
  onClose: () => void
  onDelete: (role: ServerRole) => void
  // HU-4: set this role as the server's default role for new members. Mirrors
  // onDelete — a row action the parent owns; the parent updates defaultRoleId.
  onSetDefault: (role: ServerRole) => void
  // HU-1: create a role from the given name. Resolves true on success so the
  // input can clear/close; false (validation/403/409/422) leaves it as-is.
  onCreate: (name: string) => Promise<boolean>
  // HU-2: replace a role's permission mask with the COMPLETE desired list.
  // Resolves true on success so the editor can collapse; false (403/409/422)
  // keeps it open and the caller reverts the toggles to the role's state.
  onUpdatePermissions: (role: ServerRole, permissions: string[]) => Promise<boolean>
  // HU-6: persist a new hierarchy. Receives the COMPLETE id list in the displayed
  // order (first = position 1 = top). Resolves true on success so reorder mode
  // exits; false (403/422/other) so the local order reverts to the previous one.
  onReorder: (roleIds: string[]) => Promise<boolean>
  // HU-8: open the read-only list of members that have this role. A row action
  // the parent owns (it does the fetch and opens its own modal); this component
  // only invokes it. Shown only to someone who can manage roles.
  onViewMembers?: (role: ServerRole) => void
}

// HU-2: the backend's permission vocabulary (lowercase) paired with the Spanish
// label each toggle shows. Order is fixed so the editor always reads the same.
const PERMISSION_OPTIONS: { key: string; label: string }[] = [
  { key: "administrator", label: "Administrador" },
  { key: "manage_server", label: "Gestionar servidor" },
  { key: "manage_roles", label: "Gestionar roles" },
  { key: "manage_channels", label: "Gestionar canales" },
  { key: "create_invite", label: "Crear invitaciones" },
  { key: "kick_members", label: "Expulsar miembros" },
  { key: "ban_members", label: "Banear miembros" },
  { key: "send_messages", label: "Enviar mensajes" },
  { key: "connect_voice", label: "Conectarse a voz" },
]

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
  defaultBusyId = "",
  canAdministrate = false,
  createBusy = false,
  updateBusy = false,
  reorderBusy = false,
  isOwner = false,
  ownRolePosition = null,
  onClose,
  onDelete,
  onSetDefault,
  onCreate,
  onUpdatePermissions,
  onReorder,
  onViewMembers,
}: RolesModalProps) {
  // HU-1: inline "Crear rol" input. `creating` toggles the field; `newRoleName`
  // holds its draft. Reset whenever the modal is closed so it reopens clean.
  const [creating, setCreating] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")

  // HU-2: permission editor. `editingId` is the role whose toggles are open (one
  // at a time); `draftPerms` is the working copy the toggles mutate until saved.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftPerms, setDraftPerms] = useState<string[]>([])

  // HU-6: reorder mode. `reordering` toggles the ↑/↓ layout; `order` is the local
  // working copy the arrows mutate until saved (or discarded on cancel/error).
  const [reordering, setReordering] = useState(false)
  const [order, setOrder] = useState<ServerRole[]>([])

  // Deletion is irreversible, so the trash tap arms an inline confirmation for
  // that row instead of deleting immediately. `pendingDeleteId` is the role
  // awaiting confirmation (one at a time).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) {
      setCreating(false)
      setNewRoleName("")
      setEditingId(null)
      setDraftPerms([])
      setReordering(false)
      setOrder([])
      setPendingDeleteId(null)
    }
  }, [visible])

  // Why a role can't be deleted, or "" when it can. Mirrors the backend's 409.
  const blockedReason = (role: ServerRole): string => {
    if (role.id === defaultRoleId) return "Rol por defecto"
    if (role.permissions.includes(ADMIN_PERMISSION)) return "Rol de administración"
    return ""
  }

  const handleSubmit = async () => {
    const ok = await onCreate(newRoleName)
    if (ok) {
      setNewRoleName("")
      setCreating(false)
    }
  }

  // HU-2: open a role's permission editor, seeding the draft from its current
  // permissions so toggling starts from the role's real state.
  const openEditor = (role: ServerRole) => {
    setEditingId(role.id)
    setDraftPerms([...role.permissions])
  }

  // Cancel discards the draft and collapses the editor without calling the API.
  const cancelEditor = () => {
    setEditingId(null)
    setDraftPerms([])
  }

  const togglePerm = (key: string) => {
    setDraftPerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]))
  }

  // Save sends the COMPLETE checked list. On success the editor collapses; on any
  // error the toggles revert to the role's state before editing (the parent has
  // surfaced the reason via `error`).
  const handleSavePerms = async (role: ServerRole) => {
    const ok = await onUpdatePermissions(role, draftPerms)
    if (ok) {
      setEditingId(null)
      setDraftPerms([])
    } else {
      setDraftPerms([...role.permissions])
    }
  }

  // HU-6 (CA2): a role is locked for a non-owner when it sits at their own level
  // or above (position <= their own). The owner is exempt; a non-owner with no
  // non-default role (ownRolePosition == null) can't move anything. This is a
  // helper — the backend stays the final authority and still answers 403.
  const isLocked = (role: ServerRole): boolean => {
    if (isOwner) return false
    if (ownRolePosition == null) return true
    return role.position <= ownRolePosition
  }

  // HU-6: enter reorder mode, seeding the working order from the current list.
  const enterReorder = () => {
    setCreating(false)
    setNewRoleName("")
    setEditingId(null)
    setDraftPerms([])
    setOrder([...roles])
    setReordering(true)
  }

  // Cancel reverts to the original order and exits reorder mode (no API call).
  const cancelReorder = () => {
    setReordering(false)
    setOrder([])
  }

  // HU-6: swap a role one slot up (-1) or down (+1) in local state only. Blocked
  // when either the role or its swap target is locked, so a non-owner can neither
  // move a protected role nor raise a role into a protected slot (CA2).
  const moveRole = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= order.length) return
    if (isLocked(order[index]) || isLocked(order[target])) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // Save sends the COMPLETE id list in the displayed order. On success reorder
  // mode exits and the parent replaces the list with the backend response; on any
  // error the local order reverts to the previous one (the parent surfaced why).
  const handleSaveOrder = async () => {
    const ok = await onReorder(order.map((r) => r.id))
    if (ok) {
      setReordering(false)
      setOrder([])
    } else {
      setOrder([...roles])
    }
  }

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Roles del servidor"
      subtitle="Creá o eliminá un rol. Los miembros que lo tengan pierden sus permisos al eliminarlo."
    >
      {error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      {/* HU-1: create a role. Collapsed to a single button until used. Hidden
          while reordering, which takes over the modal body (HU-6). */}
      {!reordering && (creating ? (
        <View style={{ marginBottom: 14, gap: 8 }}>
          <TextInput
            value={newRoleName}
            onChangeText={setNewRoleName}
            placeholder="Nombre del rol"
            placeholderTextColor="#5E7E82"
            editable={!createBusy}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            autoFocus
            style={FIELD}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PressableScale
              onPress={handleSubmit}
              disabled={createBusy}
              accessibilityLabel="Confirmar creación del rol"
              style={{ ...PRIMARY_BTN, opacity: createBusy ? 0.6 : 1 }}
            >
              {createBusy ? (
                <ActivityIndicator color="#04211D" size="small" />
              ) : (
                <Text style={PRIMARY_TXT}>Crear</Text>
              )}
            </PressableScale>
            <PressableScale
              onPress={() => {
                setCreating(false)
                setNewRoleName("")
              }}
              disabled={createBusy}
              accessibilityLabel="Cancelar creación del rol"
              hoverStyle={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              style={SECONDARY_BTN}
            >
              <Text style={{ color: "#8DA8AC", fontSize: 14, fontWeight: "600" }}>Cancelar</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <PressableScale
          onPress={() => setCreating(true)}
          accessibilityLabel="Crear rol"
          hoverStyle={{ backgroundColor: "rgba(55,214,192,0.22)" }}
          style={CREATE_BTN}
        >
          <Ionicons name="add" size={16} color="#37D6C0" />
          <Text style={{ color: "#37D6C0", fontSize: 13, fontWeight: "700" }}>Crear rol</Text>
        </PressableScale>
      ))}

      {/* HU-6: enter reorder mode. Shown only to someone who can manage roles
          (the exact same canAdministrate gate the parent uses to open this
          modal), when there are roles and nothing else is mid-edit. Hidden for a
          non-owner who holds no non-default role (ownRolePosition == null), since
          every row would be locked and they could not move anything. */}
      {!reordering &&
      canAdministrate &&
      (isOwner || ownRolePosition != null) &&
      roles.length > 0 &&
      !creating &&
      editingId === null ? (
        <PressableScale
          onPress={enterReorder}
          accessibilityLabel="Reordenar la jerarquía de roles"
          hoverStyle={{ backgroundColor: "rgba(55,214,192,0.22)" }}
          style={CREATE_BTN}
        >
          <Ionicons name="swap-vertical" size={16} color="#37D6C0" />
          <Text style={{ color: "#37D6C0", fontSize: 13, fontWeight: "700" }}>Reordenar</Text>
        </PressableScale>
      ) : null}

      {reordering ? (
        <>
          <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 10 }}>
            El primero es la posición 1 (la más alta). Usá las flechas para cambiar el orden.
          </Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {order.map((role, index) => {
              const locked = isLocked(role)
              const upDisabled =
                reorderBusy || index === 0 || locked || isLocked(order[index - 1])
              const downDisabled =
                reorderBusy || index === order.length - 1 || locked || isLocked(order[index + 1])
              return (
                <View key={role.id} style={ROW}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#E6F3F3", fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                      {role.name}
                    </Text>
                    <Text style={{ color: "#8DA8AC", fontSize: 11, marginTop: 2 }}>
                      {locked ? "A tu nivel o por encima" : `Posición ${index + 1}`}
                    </Text>
                  </View>
                  <PressableScale
                    onPress={() => moveRole(index, -1)}
                    disabled={upDisabled}
                    accessibilityLabel={`Subir el rol ${role.name}`}
                    hoverStyle={upDisabled ? undefined : { backgroundColor: "rgba(55,214,192,0.22)" }}
                    style={{ ...ARROW_BTN, opacity: upDisabled ? 0.35 : 1 }}
                  >
                    <Ionicons name="arrow-up" size={16} color="#37D6C0" />
                  </PressableScale>
                  <PressableScale
                    onPress={() => moveRole(index, 1)}
                    disabled={downDisabled}
                    accessibilityLabel={`Bajar el rol ${role.name}`}
                    hoverStyle={downDisabled ? undefined : { backgroundColor: "rgba(55,214,192,0.22)" }}
                    style={{ ...ARROW_BTN, opacity: downDisabled ? 0.35 : 1 }}
                  >
                    <Ionicons name="arrow-down" size={16} color="#37D6C0" />
                  </PressableScale>
                </View>
              )
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            <PressableScale
              onPress={handleSaveOrder}
              disabled={reorderBusy}
              accessibilityLabel="Guardar el nuevo orden de roles"
              style={{ ...PRIMARY_BTN, opacity: reorderBusy ? 0.6 : 1 }}
            >
              {reorderBusy ? (
                <ActivityIndicator color="#04211D" size="small" />
              ) : (
                <Text style={PRIMARY_TXT}>Guardar orden</Text>
              )}
            </PressableScale>
            <PressableScale
              onPress={cancelReorder}
              disabled={reorderBusy}
              accessibilityLabel="Cancelar el reordenamiento"
              hoverStyle={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              style={SECONDARY_BTN}
            >
              <Text style={{ color: "#8DA8AC", fontSize: 14, fontWeight: "600" }}>Cancelar</Text>
            </PressableScale>
          </View>
        </>
      ) : loading ? (
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
            const editing = editingId === role.id
            return (
              <View key={role.id} style={ROW_WRAP}>
                <View style={ROW}>
                  {/* Tapping the role opens/closes its permission editor (HU-2). */}
                  <PressableScale
                    onPress={() => (editing ? cancelEditor() : openEditor(role))}
                    pressedScale={1}
                    accessibilityLabel={`Editar permisos del rol ${role.name}`}
                    hoverStyle={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <Ionicons
                      name={editing ? "chevron-down" : "chevron-forward"}
                      size={14}
                      color="#5E7E82"
                    />
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
                  </PressableScale>
                  {/* HU-8: open the read-only list of members with this role,
                      shown only to someone who can manage roles (same
                      canAdministrate condition the parent uses to open this
                      modal). The parent does the fetch; this only invokes it. */}
                  {canAdministrate ? (
                    <PressableScale
                      onPress={() => onViewMembers?.(role)}
                      accessibilityLabel={`Ver los miembros con el rol ${role.name}`}
                      hoverStyle={{ backgroundColor: "rgba(55,214,192,0.22)" }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(55,214,192,0.12)",
                      }}
                    >
                      <Ionicons name="people-outline" size={16} color="#37D6C0" />
                    </PressableScale>
                  ) : null}
                  {/* HU-4: the default role shows a "Por defecto" badge; every
                      other role gets a "Marcar como por defecto" action, shown
                      only to someone who can manage roles (same canAdministrate
                      condition the parent uses to open this modal). */}
                  {role.id === defaultRoleId ? (
                    <View style={DEFAULT_BADGE}>
                      <Ionicons name="star" size={11} color="#37D6C0" />
                      <Text style={DEFAULT_BADGE_TXT}>Por defecto</Text>
                    </View>
                  ) : canAdministrate ? (
                    <PressableScale
                      onPress={() => onSetDefault(role)}
                      disabled={defaultBusyId === role.id}
                      accessibilityLabel={`Marcar el rol ${role.name} como rol por defecto`}
                      hoverStyle={{ backgroundColor: "rgba(55,214,192,0.22)" }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(55,214,192,0.12)",
                        opacity: defaultBusyId === role.id ? 0.6 : 1,
                      }}
                    >
                      {defaultBusyId === role.id ? (
                        <ActivityIndicator color="#37D6C0" size="small" />
                      ) : (
                        <Ionicons name="star-outline" size={16} color="#37D6C0" />
                      )}
                    </PressableScale>
                  ) : null}
                  <PressableScale
                    onPress={() => setPendingDeleteId(role.id)}
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

                {/* CA1: explicit confirmation before deleting — deletion is
                    irreversible (members lose the role's permissions). Shown
                    inline so we don't stack a second modal over this one. */}
                {pendingDeleteId === role.id ? (
                  <View style={{ paddingBottom: 12, gap: 10 }}>
                    <Text style={{ color: "#8DA8AC", fontSize: 12.5, lineHeight: 18 }}>
                      ¿Eliminar el rol{" "}
                      <Text style={{ color: "#E6F3F3", fontWeight: "700" }}>{role.name}</Text>? Los
                      miembros que lo tengan van a perder los permisos que otorga. Esta acción no se
                      puede deshacer.
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <PressableScale
                        onPress={() => {
                          onDelete(role)
                          setPendingDeleteId(null)
                        }}
                        disabled={busy}
                        accessibilityLabel={`Confirmar eliminación del rol ${role.name}`}
                        style={{
                          flex: 1,
                          borderRadius: 10,
                          paddingVertical: 11,
                          alignItems: "center",
                          backgroundColor: "#FF7F72",
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {busy ? (
                          <ActivityIndicator color="#04211D" size="small" />
                        ) : (
                          <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>
                            Eliminar
                          </Text>
                        )}
                      </PressableScale>
                      <PressableScale
                        onPress={() => setPendingDeleteId(null)}
                        disabled={busy}
                        accessibilityLabel="Cancelar eliminación del rol"
                        hoverStyle={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                        style={SECONDARY_BTN}
                      >
                        <Text style={{ color: "#8DA8AC", fontSize: 14, fontWeight: "600" }}>
                          Cancelar
                        </Text>
                      </PressableScale>
                    </View>
                  </View>
                ) : null}

                {/* HU-2: permission toggles for the open role, Spanish-labelled. */}
                {editing ? (
                  <View style={{ paddingBottom: 12, gap: 2 }}>
                    {PERMISSION_OPTIONS.map((perm) => {
                      const checked = draftPerms.includes(perm.key)
                      return (
                        <PressableScale
                          key={perm.key}
                          onPress={() => togglePerm(perm.key)}
                          disabled={updateBusy}
                          pressedScale={1}
                          accessibilityLabel={`${checked ? "Quitar" : "Agregar"} permiso ${perm.label}`}
                          hoverStyle={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                          style={PERM_ROW}
                        >
                          <Ionicons
                            name={checked ? "checkbox" : "square-outline"}
                            size={18}
                            color={checked ? "#37D6C0" : "#5E7E82"}
                          />
                          <Text style={{ color: "#E6F3F3", fontSize: 13 }}>{perm.label}</Text>
                        </PressableScale>
                      )
                    })}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <PressableScale
                        onPress={() => handleSavePerms(role)}
                        disabled={updateBusy}
                        accessibilityLabel="Guardar permisos"
                        style={{ ...PRIMARY_BTN, opacity: updateBusy ? 0.6 : 1 }}
                      >
                        {updateBusy ? (
                          <ActivityIndicator color="#04211D" size="small" />
                        ) : (
                          <Text style={PRIMARY_TXT}>Guardar</Text>
                        )}
                      </PressableScale>
                      <PressableScale
                        onPress={cancelEditor}
                        disabled={updateBusy}
                        accessibilityLabel="Cancelar edición de permisos"
                        hoverStyle={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                        style={SECONDARY_BTN}
                      >
                        <Text style={{ color: "#8DA8AC", fontSize: 14, fontWeight: "600" }}>Cancelar</Text>
                      </PressableScale>
                    </View>
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
const PERM_ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  paddingVertical: 8,
  paddingHorizontal: 4,
  borderRadius: 8,
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
const FIELD: TextStyle = {
  width: "100%",
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 11,
  color: "#E6F3F3",
  fontSize: 14,
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
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
const DEFAULT_BADGE: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  paddingHorizontal: 9,
  height: 34,
  borderRadius: 8,
  backgroundColor: "rgba(55,214,192,0.12)",
}
const DEFAULT_BADGE_TXT: TextStyle = {
  color: "#37D6C0",
  fontSize: 11.5,
  fontWeight: "700",
}
const ARROW_BTN: ViewStyle = {
  width: 34,
  height: 34,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(55,214,192,0.12)",
}
const CREATE_BTN: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 14,
  backgroundColor: "rgba(55,214,192,0.12)",
}
