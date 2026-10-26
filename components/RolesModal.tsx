import { useEffect, useRef, useState } from "react"
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
  Platform,
} from "react-native"
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
  // Whether the current user can manage roles. Reuses the parent's
  // `canManageRoles` memo (owner / ADMINISTRATOR / MANAGE_ROLES) so every role
  // action here uses the same check the parent uses to open this modal.
  canManageRoles?: boolean
  createBusy?: boolean
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
  // HU-2: open the dedicated permission editor for a role. The parent owns the
  // RolePermissionsModal and the API call; this component only invokes it (the
  // permission editing no longer lives inline in a row accordion).
  onEditPermissions: (role: ServerRole) => void
  // HU-6: persist a new hierarchy. Receives the COMPLETE id list in the displayed
  // order (first = position 1 = top). Resolves true on success so reorder mode
  // exits; false (403/422/other) so the local order reverts to the previous one.
  onReorder: (roleIds: string[]) => Promise<boolean>
  // HU-8: open the read-only list of members that have this role. A row action
  // the parent owns (it does the fetch and opens its own modal); this component
  // only invokes it. Shown only to someone who can manage roles.
  onViewMembers?: (role: ServerRole) => void
}

// HU-5 (#92): role manager — lists a server's roles and lets an admin create,
// reorder and manage each one. The parent gates visibility to admins (CA2) and
// owns the list + the API calls. Each row drills into the permission editor (its
// chevron) and exposes the rest of its actions through an overflow (⋮) menu.
// Deletion is blocked in the UI for roles the backend rejects with 409: the
// default role, and any `administrator` role. A 403/409 that still slips through
// is surfaced via `error`.
export default function RolesModal({
  visible,
  roles,
  defaultRoleId = null,
  loading = false,
  error = "",
  busyRoleId = "",
  defaultBusyId = "",
  canManageRoles = false,
  createBusy = false,
  reorderBusy = false,
  isOwner = false,
  ownRolePosition = null,
  onClose,
  onDelete,
  onSetDefault,
  onCreate,
  onEditPermissions,
  onReorder,
  onViewMembers,
}: RolesModalProps) {
  // HU-1: inline "Crear rol" input. `creating` toggles the field; `newRoleName`
  // holds its draft. Reset whenever the modal is closed so it reopens clean.
  const [creating, setCreating] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")

  // HU-6: reorder mode. `reordering` toggles the ↑/↓ layout; `order` is the local
  // working copy the arrows mutate until saved (or discarded on cancel/error).
  const [reordering, setReordering] = useState(false)
  const [order, setOrder] = useState<ServerRole[]>([])

  // Deletion is irreversible, so the trash action arms an inline confirmation for
  // that row instead of deleting immediately. `pendingDeleteId` is the role
  // awaiting confirmation (one at a time).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Overflow (⋮) menu. `menuRoleId` is the role whose menu is open (one at a
  // time); `menuAnchor` is the kebab's on-screen rect, measured on press so the
  // popover can be positioned just below and right-aligned to it.
  const [menuRoleId, setMenuRoleId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)
  // One host-view ref per kebab button so we can measureInWindow on press.
  const kebabRefs = useRef<Record<string, View | null>>({})

  useEffect(() => {
    if (!visible) {
      setCreating(false)
      setNewRoleName("")
      setReordering(false)
      setOrder([])
      setPendingDeleteId(null)
      setMenuRoleId(null)
      setMenuAnchor(null)
    }
  }, [visible])

  // Why a role can't be deleted, or "" when it can. Mirrors the backend's 409.
  const blockedReason = (role: ServerRole): string => {
    if (role.id === defaultRoleId) return "Rol por defecto"
    if (role.permissions.includes(ADMIN_PERMISSION)) return "Rol de administración"
    return ""
  }

  // The non-chip part of a row's subtitle: an admin role is summarized by name,
  // every other role by its permission count.
  const permsSummary = (role: ServerRole): string => {
    // Administrator is a wildcard the backend reads as every permission, so the
    // count would read "1 permiso" and mislead — show its real reach instead.
    if (role.permissions.includes(ADMIN_PERMISSION)) return "Todos los permisos"
    const n = role.permissions.length
    return `${n} ${n === 1 ? "permiso" : "permisos"}`
  }

  const handleSubmit = async () => {
    const ok = await onCreate(newRoleName)
    if (ok) {
      setNewRoleName("")
      setCreating(false)
    }
  }

  // Open a role's overflow menu, measuring the kebab so the popover anchors to it.
  const openMenu = (role: ServerRole) => {
    const node = kebabRefs.current[role.id]
    if (!node) return
    node.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height })
      setMenuRoleId(role.id)
    })
  }

  const closeMenu = () => {
    setMenuRoleId(null)
    setMenuAnchor(null)
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
    setPendingDeleteId(null)
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

  const menuRole = menuRoleId ? roles.find((r) => r.id === menuRoleId) ?? null : null

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
          (the exact same canManageRoles gate the parent uses to open this
          modal), when there are roles and nothing else is mid-edit. Hidden for a
          non-owner who holds no non-default role (ownRolePosition == null), since
          every row would be locked and they could not move anything. */}
      {!reordering &&
      canManageRoles &&
      (isOwner || ownRolePosition != null) &&
      roles.length > 0 &&
      !creating ? (
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
            const busy = busyRoleId === role.id
            const isDefault = role.id === defaultRoleId
            return (
              <View key={role.id} style={ROW_WRAP}>
                <View style={ROW}>
                  {/* Drill-in: the left region (chevron + name + subtitle) opens
                      the dedicated permission editor (HU-2). */}
                  <PressableScale
                    onPress={() => onEditPermissions(role)}
                    pressedScale={1}
                    accessibilityLabel={`Editar permisos del rol ${role.name}`}
                    hoverStyle={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <Ionicons name="chevron-forward" size={14} color="#5E7E82" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#E6F3F3", fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                        {role.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        {isDefault ? (
                          <View style={DEFAULT_CHIP}>
                            <Text style={DEFAULT_CHIP_TXT}>Por defecto</Text>
                          </View>
                        ) : null}
                        <Text style={{ color: "#8DA8AC", fontSize: 11 }} numberOfLines={1}>
                          {isDefault ? `· ${permsSummary(role)}` : permsSummary(role)}
                        </Text>
                      </View>
                    </View>
                  </PressableScale>

                  {/* Single overflow (⋮) menu holding members / set-default /
                      delete, shown only to someone who can manage roles (the same
                      canManageRoles gate the parent uses to open this modal). */}
                  {canManageRoles ? (
                    <View
                      ref={(node) => {
                        kebabRefs.current[role.id] = node
                      }}
                      collapsable={false}
                    >
                      <PressableScale
                        onPress={() => openMenu(role)}
                        accessibilityLabel={`Más acciones para el rol ${role.name}`}
                        hoverStyle={{ backgroundColor: "rgba(55,214,192,0.22)" }}
                        style={ICON_BTN}
                      >
                        {busy ? (
                          <ActivityIndicator color="#37D6C0" size="small" />
                        ) : (
                          <Ionicons name="ellipsis-vertical" size={16} color="#37D6C0" />
                        )}
                      </PressableScale>
                    </View>
                  ) : null}
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
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* Overflow menu popover for the open role, anchored to its kebab. */}
      {menuRole && menuAnchor ? (
        <RoleOverflowMenu
          anchor={menuAnchor}
          isDefault={menuRole.id === defaultRoleId}
          blockedReason={blockedReason(menuRole)}
          onClose={closeMenu}
          onViewMembers={() => {
            closeMenu()
            onViewMembers?.(menuRole)
          }}
          onSetDefault={() => {
            closeMenu()
            onSetDefault(menuRole)
          }}
          onDelete={() => {
            closeMenu()
            setPendingDeleteId(menuRole.id)
          }}
        />
      ) : null}
    </ModalShell>
  )
}

interface MenuAnchor {
  x: number
  y: number
  width: number
  height: number
}

interface RoleOverflowMenuProps {
  anchor: MenuAnchor
  isDefault: boolean
  // Non-empty when the role can't be deleted; shown as the disabled item's note.
  blockedReason: string
  onClose: () => void
  onViewMembers: () => void
  onSetDefault: () => void
  onDelete: () => void
}

// Small polished popover for a role's overflow actions. Rendered in its own
// transparent Modal so it floats above the roles modal; a full-screen backdrop
// closes it on an outside press (or Escape on web). The card is positioned just
// below the kebab and right-aligned to it, and grows out of its top-right corner.
function RoleOverflowMenu({
  anchor,
  isDefault,
  blockedReason,
  onClose,
  onViewMembers,
  onSetDefault,
  onDelete,
}: RoleOverflowMenuProps) {
  // Drive the origin-aware pop-in once mounted (web transition; on native the
  // Modal's own fade covers the appearance).
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Close on Escape (web only, best-effort).
  useEffect(() => {
    if (Platform.OS !== "web") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const windowWidth = Dimensions.get("window").width

  // Position: top just below the kebab; right edge aligned to the kebab's right.
  const cardStyle: ViewStyle = {
    position: "absolute",
    top: anchor.y + anchor.height + 6,
    right: Math.max(8, windowWidth - (anchor.x + anchor.width)),
    minWidth: 200,
    borderRadius: 10,
    paddingVertical: 6,
    backgroundColor: "#0C2523",
    borderWidth: 1,
    borderColor: "#1A3A3A",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 18px 44px -16px rgba(0,0,0,0.75)",
          opacity: shown ? 1 : 0,
          transform: [{ scale: shown ? 1 : 0.96 }],
          transformOrigin: "top right",
          transitionProperty: "opacity, transform",
          transitionDuration: "160ms",
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        } as object)
      : {
          shadowColor: "#000",
          shadowOpacity: 0.5,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
        }),
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar menú">
        {/* Stop the card from forwarding presses to the backdrop. */}
        <Pressable style={cardStyle} onPress={() => {}}>
          <MenuItem
            icon="people-outline"
            label="Ver miembros"
            onPress={onViewMembers}
          />
          {!isDefault ? (
            <MenuItem
              icon="checkmark-circle-outline"
              label="Marcar como por defecto"
              onPress={onSetDefault}
            />
          ) : null}
          <MenuItem
            icon="trash-outline"
            label="Eliminar"
            color="#FF7F72"
            disabled={blockedReason !== ""}
            note={blockedReason ? `No se puede: ${blockedReason}` : undefined}
            onPress={onDelete}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  color?: string
  disabled?: boolean
  note?: string
  onPress: () => void
}

function MenuItem({ icon, label, color = "#E6F3F3", disabled = false, note, onPress }: MenuItemProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      pressedScale={0.97}
      accessibilityLabel={label}
      hoverStyle={disabled ? undefined : { backgroundColor: "rgba(55,214,192,0.12)" }}
      style={{ ...MENU_ITEM, opacity: disabled ? 0.45 : 1 }}
    >
      <Ionicons name={icon} size={16} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color, fontSize: 13.5, fontWeight: "600" }}>{label}</Text>
        {note ? (
          <Text style={{ color: "#5E7E82", fontSize: 11, marginTop: 2 }}>{note}</Text>
        ) : null}
      </View>
    </PressableScale>
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
const ICON_BTN: ViewStyle = {
  width: 34,
  height: 34,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(55,214,192,0.12)",
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
// Subtle state label (NOT a button): small rounded pill that only marks the
// default role. Hairline border keeps it readable without reading as tappable.
const DEFAULT_CHIP: ViewStyle = {
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 6,
  backgroundColor: "rgba(55,214,192,0.12)",
  borderWidth: 1,
  borderColor: "#1A3A3A",
}
const DEFAULT_CHIP_TXT: TextStyle = {
  color: "#37D6C0",
  fontSize: 11,
  fontWeight: "600",
}
const MENU_ITEM: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  paddingVertical: 9,
  paddingHorizontal: 12,
  borderRadius: 8,
}
