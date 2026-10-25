import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Platform,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from "react-native"
import type { ViewStyle, TextStyle } from "react-native"
import * as ImagePicker from "expo-image-picker"
import * as Clipboard from "expo-clipboard"
import { useLocalSearchParams, useRouter } from "expo-router"
import {
  getServers,
  getCategories,
  getServerMembers,
  getMessages,
  sendMessage,
  createServer,
  createInvite,
  listInvites,
  revokeInvite,
  joinServer,
  leaveServer,
  deleteServer,
  deleteChannel,
  updateChannel,
  reorderChannels,
  createChannel,
  startOwnershipTransfer,
  getPendingTransfer,
  acceptOwnershipTransfer,
  rejectOwnershipTransfer,
  updateServer,
  getServerRoles,
  getDefaultRoleId,
  setDefaultRole,
  deleteRole,
  createRole,
  updateRolePermissions,
  reorderRoles,
  getMemberPermissions,
  getMemberRoles,
  assignRoleToMember,
  removeRoleFromMember,
  getChannelOverwrites,
  setChannelOverwrite,
  deleteChannelOverwrite,
  getRoleMembers,
  ADMIN_PERMISSION,
  MANAGE_ROLES_PERMISSION,
} from "@/api"
import type { Server, Category, RoleGroup, ServerRole, Member, ServerMember, Message, Invite, OwnershipTransfer, ChannelOverwrite } from "@/api/types"
import { ApiError, friendlyError } from "@/api/client"
import { useAuth } from "@/context/AuthContext"
import { Ionicons } from "@expo/vector-icons"
import Avatar from "@/components/Avatar"
import StatusDot, { STATUS_LABELS } from "@/components/StatusDot"
import ModalShell from "@/components/ModalShell"
import PressableScale from "@/components/PressableScale"
import DeleteServerModal from "@/components/DeleteServerModal"
import ServerSettingsModal from "@/components/ServerSettingsModal"
import RolesModal from "@/components/RolesModal"
import MemberRolesModal from "@/components/MemberRolesModal"
import RoleMembersModal from "@/components/RoleMembersModal"
import ChannelPermissionsModal from "@/components/ChannelPermissionsModal"

const SERVER_NAME_MAX = 100

// Rail servers with non-UUID ids ("1".."4") are mock/example servers. Real
// backend actions (invite, leave...) only make sense against a real server id.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRealServerId(id: string): boolean {
  return UUID_RE.test(id)
}

// HU-7: maps a channel-overwrite API failure to a user-safe Spanish message.
// 403: lacking permission (or changing a permission you don't hold). 404: the
// channel or role no longer exists. 422: the permission isn't valid for a
// channel. Anything else falls back to the shared friendlyError mapping.
function channelOverwriteError(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) {
    return "No tenés permisos para cambiar los permisos de este canal o alguno de esos permisos."
  }
  if (err instanceof ApiError && err.status === 404) {
    return "El canal o el rol ya no existe."
  }
  if (err instanceof ApiError && err.status === 422) {
    return "Alguno de los permisos no es válido para un canal."
  }
  return friendlyError(err)
}

// HU-8: maps a "ver miembros por rol" API failure to a user-safe Spanish
// message. 403: not a member or lacking MANAGE_ROLES. 404: the role (or server)
// no longer exists. Anything else falls back to the shared friendlyError mapping.
function viewRoleMembersError(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) {
    return "No tenés permisos para ver los miembros de este rol."
  }
  if (err instanceof ApiError && err.status === 404) {
    return "El rol ya no existe."
  }
  return friendlyError(err)
}

// HU-2 (CA1): invite configuration options. Values are what the backend expects:
// expiration in seconds (null = never), max uses as a count (null = unlimited).
const INVITE_EXPIRY_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Nunca", value: null },
  { label: "1 hora", value: 3600 },
  { label: "1 día", value: 86400 },
  { label: "7 días", value: 604800 },
]
const INVITE_MAX_USES_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Ilimitado", value: null },
  { label: "1", value: 1 },
  { label: "5", value: 5 },
  { label: "10", value: 10 },
]

// Human-readable, relative expiration computed from the invite's `expiresAt`.
function formatInviteExpiry(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "Sin expiración"
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return "Expirada"
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `Expira en ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Expira en ${hours} h`
  const days = Math.round(hours / 24)
  return `Expira en ${days} día${days === 1 ? "" : "s"}`
}

// "3/5 usos" when capped, "3 usos" when unlimited.
function formatInviteUses(inv: Invite): string {
  return inv.maxUses == null ? `${inv.uses} usos` : `${inv.uses}/${inv.maxUses} usos`
}

// Groups real server members (from getServerMembers) into the role sections the
// member panel renders. The backend only knows "owner" / "member".
function membersToRoleGroups(members: ServerMember[]): RoleGroup[] {
  const toMember = (m: ServerMember, color: string): Member => ({
    id: m.userId,
    name: m.name,
    avatar: m.avatar,
    color,
    status: m.status,
  })
  const owners = members.filter((m) => m.role === "owner")
  const rest = members.filter((m) => m.role !== "owner")
  const groups: RoleGroup[] = []
  if (owners.length > 0) {
    groups.push({ name: "Owner", color: "#37D6C0", members: owners.map((m) => toMember(m, "#37D6C0")) })
  }
  if (rest.length > 0) {
    groups.push({ name: "Miembros", color: "#8DA8AC", members: rest.map((m) => toMember(m, "#8DA8AC")) })
  }
  return groups
}

const MOCK_SERVER_NOTICE =
  "Este es un servidor de ejemplo. Creá o unite a un servidor real para usar esta acción."

// Shared control tokens so every modal speaks the same visual language:
// one radius scale (controls at 10), one field treatment, one primary button.
const LABEL: TextStyle = {
  color: "#8DA8AC",
  fontSize: 10,
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: 1.1,
  marginBottom: 6,
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
  width: "100%",
  borderRadius: 10,
  paddingVertical: 12,
  alignItems: "center",
  backgroundColor: "#37D6C0",
}
const PRIMARY_TXT: TextStyle = { fontWeight: "700", fontSize: 14, color: "#04211D" }
const NOTICE_ERROR: ViewStyle = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 14,
  backgroundColor: "rgba(255,127,114,0.12)",
  borderWidth: 1,
  borderColor: "rgba(255,127,114,0.30)",
}
const NOTICE_OK: ViewStyle = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 14,
  backgroundColor: "rgba(55,214,192,0.12)",
  borderWidth: 1,
  borderColor: "rgba(55,214,192,0.30)",
}

const PRESENCE_REFRESH_MS = 15_000

export default function ChatScreen() {
  const router = useRouter()
  const { serverId: requestedServerId } = useLocalSearchParams<{ serverId?: string }>()
  const { user } = useAuth()
  // No server is selected until the real list loads. Never default to a mock id,
  // or the app boots into a phantom server (and its mock channels/messages) even
  // when the user has none.
  const [activeServer, setActiveServer] = useState("")
  const [activeChannel, setActiveChannel] = useState("")
  const [showMembers, setShowMembers] = useState(false)
  const [input, setInput] = useState("")

  const { width: screenWidth } = useWindowDimensions()
  const isNarrow = screenWidth < 720
  const [channelSidebarOpen, setChannelSidebarOpen] = useState(false)

  // Web-only hover tooltip for the server rail: shows the full server name next
  // to its icon, so long names stay discoverable even when the icon is just an
  // abbreviation or a photo.
  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null)
  const [hoveredMember, setHoveredMember] = useState<string | null>(null)

  const showTooltip = (label: string) => (e: any) => {
    if (Platform.OS !== "web") return
    const rect = e?.currentTarget?.getBoundingClientRect?.()
    if (rect) setTooltip({ label, y: rect.top + rect.height / 2 })
  }
  const hideTooltip = () => setTooltip(null)

  const [servers, setServers] = useState<Server[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [roles, setRoles] = useState<RoleGroup[]>([])
  const [messages, setMessages] = useState<Message[]>([])

  // Add-server modal (HU-1 create / HU-3 join)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addMode, setAddMode] = useState<"create" | "join">("create")
  const [serverName, setServerName] = useState("")
  const [serverIcon, setServerIcon] = useState<
    Blob | { uri: string; name: string; type: string } | null
  >(null)
  const [iconLabel, setIconLabel] = useState("")
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState("")
  const [joinInput, setJoinInput] = useState("")
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState("")
  const [joinNotice, setJoinNotice] = useState("")

  // Invite panel (HU-2 generate invitation)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [copied, setCopied] = useState(false)
  // CA1: invite configuration (expiration + usage limit) chosen before generating.
  const [inviteExpires, setInviteExpires] = useState<number | null>(null)
  const [inviteMaxUses, setInviteMaxUses] = useState<number | null>(null)
  // CA4: the server's active invites, listed in the same modal for revocation.
  const [activeInvites, setActiveInvites] = useState<Invite[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [invitesError, setInvitesError] = useState("")
  const [revokingId, setRevokingId] = useState<string | null>(null)

  // Delete-channel confirmation
  const [deleteChOpen, setDeleteChOpen] = useState(false)
  const [deleteChTarget, setDeleteChTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteChBusy, setDeleteChBusy] = useState(false)
  const [deleteChError, setDeleteChError] = useState("")

  // Edit-channel modal
  const [editChOpen, setEditChOpen] = useState(false)
  const [editChTarget, setEditChTarget] = useState<{ id: string; name: string; topic?: string | null } | null>(null)
  const [editChName, setEditChName] = useState("")
  const [editChTopic, setEditChTopic] = useState("")
  const [editChBusy, setEditChBusy] = useState(false)
  const [editChError, setEditChError] = useState("")

  // Create-channel modal
  const [createChOpen, setCreateChOpen] = useState(false)
  const [createChName, setCreateChName] = useState("")
  const [createChType, setCreateChType] = useState<"text" | "voice">("text")
  const [createChBusy, setCreateChBusy] = useState(false)
  const [createChError, setCreateChError] = useState("")

  // Leave-server confirmation (HU-5)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [leaveError, setLeaveError] = useState("")

  const [deleteSrvOpen, setDeleteSrvOpen] = useState(false)
  const [deleteSrvBusy, setDeleteSrvBusy] = useState(false)
  const [deleteSrvError, setDeleteSrvError] = useState("")

  // Server settings (HU-4 / #95), banner-only for now. Admin-gated.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsError, setSettingsError] = useState("")

  // Role manager (HU-5 / #92). Admin-gated.
  const [rolesOpen, setRolesOpen] = useState(false)
  const [rolesList, setRolesList] = useState<ServerRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [rolesError, setRolesError] = useState("")
  const [roleBusyId, setRoleBusyId] = useState("")
  const [roleCreateBusy, setRoleCreateBusy] = useState(false)
  const [roleUpdateBusy, setRoleUpdateBusy] = useState(false)
  const [defaultRoleId, setDefaultRoleId] = useState<string | null>(null)
  // HU-4: the role whose "Marcar como por defecto" request is in flight.
  const [roleDefaultBusyId, setRoleDefaultBusyId] = useState("")
  // HU-6: reorder hierarchy. `roleReorderBusy` flags the save request; the
  // current user's own roles feed the client-side hierarchy helper (CA2).
  const [roleReorderBusy, setRoleReorderBusy] = useState(false)
  const [currentUserRoles, setCurrentUserRoles] = useState<ServerRole[]>([])

  // HU-3: per-member role assignment selector. Admin-gated (same condition as
  // the role manager). `memberRolesList` is every server role; `memberAssignedIds`
  // is the loaded set of ids the target member already has (pre-checked).
  const [memberRolesOpen, setMemberRolesOpen] = useState(false)
  const [memberRolesTarget, setMemberRolesTarget] = useState<{ id: string; name: string } | null>(null)
  const [memberRolesList, setMemberRolesList] = useState<ServerRole[]>([])
  const [memberAssignedIds, setMemberAssignedIds] = useState<string[]>([])
  const [memberRolesLoading, setMemberRolesLoading] = useState(false)
  const [memberRolesError, setMemberRolesError] = useState("")
  const [memberRoleBusyId, setMemberRoleBusyId] = useState("")

  // HU-8: read-only "ver miembros por rol" list. Admin-gated (same condition as
  // the role manager). `roleMembersTarget` is the role being inspected (id+name);
  // `roleMembersList` is the loaded members that have it.
  const [roleMembersOpen, setRoleMembersOpen] = useState(false)
  const [roleMembersTarget, setRoleMembersTarget] = useState<{ id: string; name: string } | null>(null)
  const [roleMembersList, setRoleMembersList] = useState<ServerMember[]>([])
  const [roleMembersLoading, setRoleMembersLoading] = useState(false)
  const [roleMembersError, setRoleMembersError] = useState("")

  // HU-7: per-channel role permission overrides. Admin-gated (same canAdministrate
  // condition as the role manager). The channel being edited (editChTarget) is the
  // target; `channelOverwrites` is the channel's loaded overwrites and
  // `channelPermsList` every server role.
  const [channelPermsOpen, setChannelPermsOpen] = useState(false)
  const [channelPermsTarget, setChannelPermsTarget] = useState<{ id: string; name: string } | null>(null)
  const [channelPermsList, setChannelPermsList] = useState<ServerRole[]>([])
  const [channelOverwrites, setChannelOverwrites] = useState<ChannelOverwrite[]>([])
  const [channelPermsLoading, setChannelPermsLoading] = useState(false)
  const [channelPermsError, setChannelPermsError] = useState("")
  const [channelPermsBusyId, setChannelPermsBusyId] = useState("")

  // Admin permissions the current user holds in the active server, flattened
  // from the backend's own role permissions (HU-4/HU-5 gating). Empty when the
  // user isn't an admin or it couldn't be confirmed -> falls back to owner-only.
  const [memberPermissions, setMemberPermissions] = useState<string[]>([])

  // Ownership transfer (HU-7)
  // Owner-initiated transfer modal.
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferSelectedId, setTransferSelectedId] = useState("")
  const [transferTargetName, setTransferTargetName] = useState("")
  const [transferConfirmName, setTransferConfirmName] = useState("")
  const [transferBusy, setTransferBusy] = useState(false)
  const [transferError, setTransferError] = useState("")
  // Pending transfer relevant to the caller in the active server (banner for the
  // recipient). null when there is none.
  const [pendingTransfer, setPendingTransfer] = useState<OwnershipTransfer | null>(null)
  const [transferActionBusy, setTransferActionBusy] = useState(false)
  const [bannerError, setBannerError] = useState("")

  useEffect(() => {
    getServers()
      .then((list) => {
        setServers(list)
        setActiveServer((current) => current || list[0]?.id || "")
      })
      .catch(() => setBannerError("No pudimos cargar tus servidores. Probá de nuevo en un rato."))
  }, [])

  useEffect(() => {
    if (requestedServerId && servers.some((s) => s.id === requestedServerId)) {
      setActiveServer(requestedServerId)
    }
  }, [requestedServerId, servers])

  useEffect(() => {
    if (!activeServer) {
      // No server selected (e.g. the user has none): clear everything so no mock
      // channel or roster leaks through.
      setCategories([])
      setRoles([])
      setActiveChannel("")
      return
    }
    getCategories(activeServer)
      .then((cats) => {
        setCategories(cats)
        const firstText = cats.flatMap((c) => c.channels).find((c) => c.type === "text")
        setActiveChannel(firstText ? firstText.id : "")
      })
      .catch(() => {
        setCategories([])
        setActiveChannel("")
      })
    // Real roster from the backend (owner + members), hydrated with names/avatars.
    getServerMembers(activeServer)
      .then((members) => setRoles(membersToRoleGroups(members)))
      .catch(() => setRoles([]))
  }, [activeServer])

  useEffect(() => {
    if (!activeServer || !isRealServerId(activeServer)) return
    let active = true
    const timer = setInterval(() => {
      getServerMembers(activeServer)
        .then((members) => {
          if (active) setRoles(membersToRoleGroups(members))
        })
        .catch(() => undefined)
    }, PRESENCE_REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [activeServer])

  useEffect(() => {
    if (!activeChannel) {
      setMessages([])
      return
    }
    getMessages(activeChannel)
      .then(setMessages)
      .catch(() => setMessages([]))
  }, [activeChannel])

  // HU-4/HU-5 gating: load the current user's admin permissions for the active
  // real server, so the banner config and role manager can be surfaced to
  // admins (not just the owner). Clears on server change; on any failure it
  // stays empty, so the UI falls back to owner-only gating.
  useEffect(() => {
    setMemberPermissions([])
    if (!activeServer || !isRealServerId(activeServer) || !user?.id) return
    let active = true
    getMemberPermissions(activeServer, user.id)
      .then((perms) => {
        if (active) setMemberPermissions(perms)
      })
      .catch(() => {
        if (active) setMemberPermissions([])
      })
    return () => {
      active = false
    }
  }, [activeServer, user?.id])

  // HU-7: when a real server becomes active, check for a pending ownership
  // transfer relevant to the caller. The recipient of a pending transfer sees a
  // banner; everyone else (and mock servers) sees nothing.
  useEffect(() => {
    setPendingTransfer(null)
    setBannerError("")
    if (!activeServer || !isRealServerId(activeServer)) return
    let active = true
    getPendingTransfer(activeServer)
      .then((transfer) => {
        if (active) setPendingTransfer(transfer)
      })
      .catch(() => {
        if (active) setPendingTransfer(null)
      })
    return () => {
      active = false
    }
  }, [activeServer])

  const channel = categories.flatMap((c) => c.channels).find((c) => c.id === activeChannel)

  // Owner of the active server (derived): only the owner may initiate a transfer.
  // Recomputes whenever `servers` refreshes, so after an accepted transfer the
  // ex-owner loses the control and the new owner gains it.
  const isOwner =
    !!activeServer && servers.find((s) => s.id === activeServer)?.ownerId === user?.id

  const activeServerName = servers.find((s) => s.id === activeServer)?.name ?? ""
  const activeServerBannerUrl = servers.find((s) => s.id === activeServer)?.bannerUrl ?? null
  const activeServerIconUrl = servers.find((s) => s.id === activeServer)?.iconUrl ?? null

  // Admin of the active server: the owner always qualifies; a non-owner member
  // qualifies when the backend grants them the `administrator` permission. Gates
  // the banner config (CA2 of #95) and the role manager (CA2 of #92). Falls back
  // to owner-only when permissions couldn't be confirmed.
  const canAdministrate =
    !!activeServer &&
    isRealServerId(activeServer) &&
    (isOwner || memberPermissions.includes(ADMIN_PERMISSION))

  // Can manage roles: the backend lets anyone with MANAGE_ROLES (or ADMINISTRATOR,
  // or the owner) administer roles — a wider set than canAdministrate, which only
  // accepts the owner or ADMINISTRATOR. Gates ALL the role UI (create/edit/delete/
  // default/reorder, assign per member, view members). Per-channel overwrites
  // (HU-7) deliberately stay under canAdministrate: they live inside the
  // admin-gated "Editar canal" modal, so a manage_roles-only user cannot reach
  // them from the UI (documented limitation). Same real-server/fallback rules.
  const canManageRoles =
    !!activeServer &&
    isRealServerId(activeServer) &&
    (isOwner ||
      memberPermissions.includes(ADMIN_PERMISSION) ||
      memberPermissions.includes(MANAGE_ROLES_PERMISSION))

  // Whether the owner may offer ownership to a given member row: only the owner,
  // only on real servers, and never the owner's own row.
  const canOfferTransferTo = (memberId: string) =>
    isOwner && isRealServerId(activeServer) && memberId !== user?.id

  // The recipient sees an actionable banner (accept/reject); the sender sees an
  // informational one while the transfer stays pending.
  const isPending = !!pendingTransfer && pendingTransfer.status === "pending" && !!user?.id
  const isTransferRecipient = isPending && pendingTransfer!.toUserId === user!.id
  const isTransferSender = isPending && pendingTransfer!.fromUserId === user!.id

  const canTransfer =
    transferSelectedId !== "" && transferConfirmName.trim() === activeServerName

  // Opens the transfer modal scoped to a specific member (chosen from the member
  // panel row), so the confirmation dialog knows exactly who receives ownership.
  const openTransferForMember = (memberId: string, memberName: string) => {
    setTransferSelectedId(memberId)
    setTransferTargetName(memberName)
    setTransferConfirmName("")
    setTransferError("")
    setTransferOpen(true)
  }

  const handleTransfer = async () => {
    if (!canTransfer) return
    setTransferBusy(true)
    setTransferError("")
    try {
      await startOwnershipTransfer(activeServer, transferSelectedId)
      setTransferOpen(false)
      // Surface the now-pending transfer (awaiting the recipient's acceptance)
      // via the sender-side banner, using the same GET the recipient relies on.
      const pending = await getPendingTransfer(activeServer)
      setPendingTransfer(pending)
    } catch (err) {
      setTransferError(friendlyError(err))
    } finally {
      setTransferBusy(false)
    }
  }

  const handleAcceptTransfer = async () => {
    setBannerError("")
    setTransferActionBusy(true)
    try {
      await acceptOwnershipTransfer(activeServer)
      setPendingTransfer(null)
      // Refresh so permissions update: owner_id changes, so the new owner now
      // sees the owner controls; the roster/roles reflect the new owner too.
      const refreshed = await getServers()
      setServers(refreshed)
      const members = await getServerMembers(activeServer)
      setRoles(membersToRoleGroups(members))
    } catch (err) {
      setBannerError(friendlyError(err))
    } finally {
      setTransferActionBusy(false)
    }
  }

  const handleRejectTransfer = async () => {
    setBannerError("")
    setTransferActionBusy(true)
    try {
      await rejectOwnershipTransfer(activeServer)
      setPendingTransfer(null)
    } catch (err) {
      setBannerError(friendlyError(err))
    } finally {
      setTransferActionBusy(false)
    }
  }

  const openDeleteServer = () => {
    setDeleteSrvError("")
    setDeleteSrvOpen(true)
  }

  const handleDeleteServer = async (confirmationName: string) => {
    setDeleteSrvBusy(true)
    setDeleteSrvError("")
    try {
      await deleteServer(activeServer, confirmationName)
      const remaining = servers.filter((s) => s.id !== activeServer)
      setServers(remaining)
      setActiveServer(remaining[0]?.id ?? "")
      setDeleteSrvOpen(false)
    } catch (err) {
      setDeleteSrvError(friendlyError(err))
    } finally {
      setDeleteSrvBusy(false)
    }
  }

  // HU-4 (#95): open the server settings (banner) modal.
  const openSettings = () => {
    setSettingsError("")
    setSettingsOpen(true)
  }

  const handleSaveSettings = async (fields: {
    name?: string
    icon?: Blob | { uri: string; name: string; type: string }
    banner?: Blob | { uri: string; name: string; type: string }
  }) => {
    setSettingsBusy(true)
    setSettingsError("")
    try {
      const updated = await updateServer(activeServer, fields)
      // Reflect the new name/icon/banner for everyone in the server list (CA1).
      setServers((prev) =>
        prev.map((s) =>
          s.id === updated.id
            ? { ...s, name: updated.name, abbr: updated.abbr, iconUrl: updated.iconUrl, bannerUrl: updated.bannerUrl }
            : s,
        ),
      )
      setSettingsOpen(false)
    } catch (err) {
      // 422 = empty patch or invalid name/image; the backend persisted nothing (CA3).
      // Its Spanish detail is specific (name vs image), so surface it via friendlyError.
      if (err instanceof ApiError && err.status === 503) {
        setSettingsError("El almacenamiento de imágenes no está disponible ahora. Probá de nuevo en un rato.")
      } else {
        setSettingsError(friendlyError(err))
      }
    } finally {
      setSettingsBusy(false)
    }
  }

  // HU-5 (#92): open the role manager and load the real role list plus the
  // default role (so its deletion can be blocked, matching the backend's 409).
  const openRoles = async () => {
    setRolesOpen(true)
    setRolesError("")
    setRoleBusyId("")
    if (!isRealServerId(activeServer)) {
      setRolesList([])
      setCurrentUserRoles([])
      return
    }
    setRolesLoading(true)
    try {
      // HU-6: also load the current user's own roles so the reorder helper (CA2)
      // can compute their hierarchy level without a separate round-trip.
      const [list, defaultId, myRoles] = await Promise.all([
        getServerRoles(activeServer),
        getDefaultRoleId(activeServer),
        user?.id ? getMemberRoles(activeServer, user.id) : Promise.resolve([] as ServerRole[]),
      ])
      setRolesList(list)
      setDefaultRoleId(defaultId)
      setCurrentUserRoles(myRoles)
    } catch (err) {
      setRolesError(friendlyError(err))
      setRolesList([])
    } finally {
      setRolesLoading(false)
    }
  }

  const handleDeleteRole = async (role: ServerRole) => {
    setRoleBusyId(role.id)
    setRolesError("")
    try {
      await deleteRole(activeServer, role.id)
      // CA1: the role is gone -> drop it from the list so its members' perms
      // visibly refresh. The backend already revoked it from every member.
      setRolesList((prev) => prev.filter((r) => r.id !== role.id))
    } catch (err) {
      // CA2: 403 without admin permission. 409: default/own-admin role.
      if (err instanceof ApiError && err.status === 409) {
        setRolesError("Ese rol no se puede eliminar: es el rol por defecto o un rol de administración que tenés asignado.")
      } else {
        setRolesError(friendlyError(err))
      }
    } finally {
      setRoleBusyId("")
    }
  }

  // HU-4 (#95): set a role as the server's default role for new members.
  // Mirrors the other role handlers' in-place state update: on success the local
  // defaultRoleId is replaced (no reload), so the "Por defecto" mark and the
  // delete-disable move to the new role and the previous role becomes deletable
  // again (unless it's an admin role — RolesModal keeps that guard). On error
  // defaultRoleId is never touched, so the mark stays on the previous role.
  const handleSetDefaultRole = async (role: ServerRole) => {
    setRoleDefaultBusyId(role.id)
    setRolesError("")
    try {
      const newDefaultId = await setDefaultRole(activeServer, role.id)
      setDefaultRoleId(newDefaultId)
    } catch (err) {
      // 403: missing MANAGE_ROLES/ADMINISTRATOR, or setting a role whose
      // permissions the caller doesn't hold themselves.
      if (err instanceof ApiError && err.status === 403) {
        setRolesError("No tenés permisos para definir este rol como rol por defecto.")
      } else {
        setRolesError(friendlyError(err))
      }
    } finally {
      setRoleDefaultBusyId("")
    }
  }

  // HU-1: create a role. The backend assigns default permissions + position, so
  // we only send the name. Returns true on success so the modal can clear its
  // input. Mirrors handleDeleteRole's state update: on success the new role is
  // appended to the END of the list, no screen reload.
  const handleCreateRole = async (name: string): Promise<boolean> => {
    const trimmed = name.trim()
    setRolesError("")
    // Frontend validation before calling the API: non-empty, at most 100 chars.
    if (trimmed === "" || trimmed.length > 100) {
      setRolesError("El nombre del rol no es válido.")
      return false
    }
    setRoleCreateBusy(true)
    try {
      const created = await createRole(activeServer, trimmed)
      setRolesList((prev) => [...prev, created])
      return true
    } catch (err) {
      // CA2: 403 without permission. 409: duplicate name. 422: invalid name.
      if (err instanceof ApiError && err.status === 403) {
        setRolesError("No tenés permisos para crear roles en este servidor.")
      } else if (err instanceof ApiError && err.status === 409) {
        setRolesError("Ya existe un rol con ese nombre.")
      } else if (err instanceof ApiError && err.status === 422) {
        setRolesError("El nombre del rol no es válido.")
      } else {
        setRolesError(friendlyError(err))
      }
      return false
    } finally {
      setRoleCreateBusy(false)
    }
  }

  // HU-2: edit a role's permissions. Sends the COMPLETE desired list (the backend
  // replaces the whole mask). Returns true on success so the modal can collapse
  // the editor; false (403/409/422) keeps it open and the modal reverts its
  // toggles. Mirrors handleCreateRole/handleDeleteRole's in-place state update:
  // on 200 the updated role replaces the old one by id, so the "N permisos"
  // counter refreshes without a screen reload.
  const handleUpdateRolePermissions = async (
    role: ServerRole,
    permissions: string[],
  ): Promise<boolean> => {
    setRoleUpdateBusy(true)
    setRolesError("")
    try {
      const updated = await updateRolePermissions(activeServer, role.id, permissions)
      setRolesList((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      return true
    } catch (err) {
      // CA3: 403 without permission or granting/removing a perm you lack.
      // CA2: 409 removing administrator from your own role. 422: invalid perm.
      if (err instanceof ApiError && err.status === 403) {
        setRolesError("No tenés permisos para modificar este rol o alguno de sus permisos.")
      } else if (err instanceof ApiError && err.status === 409) {
        setRolesError("No podés quitarle el permiso de administración a tu propio rol.")
      } else if (err instanceof ApiError && err.status === 422) {
        setRolesError("Alguno de los permisos no es válido.")
      } else {
        setRolesError(friendlyError(err))
      }
      return false
    } finally {
      setRoleUpdateBusy(false)
    }
  }

  // HU-6: the current user's own hierarchy position — the LOWEST position number
  // (= highest in the hierarchy) among their roles, EXCLUDING the default role.
  // null when they hold no non-default role. The owner is exempt (handled via
  // `isOwner` in the modal), so this is only consulted for non-owners. Mirrors
  // the backend's "own role" rule so the reorder UI can pre-disable illegal moves.
  const ownRolePosition = currentUserRoles
    .filter((r) => r.id !== defaultRoleId)
    .reduce<number | null>((min, r) => (min === null || r.position < min ? r.position : min), null)

  // HU-6: persist a new role order. Sends the COMPLETE id list in the displayed
  // order (first = position 1 = top). Mirrors the other role handlers' in-place
  // update: on 200 the modal's list is replaced with the backend's reordered
  // response (no reload). Returns true on success so the modal exits reorder
  // mode; false (403/422/other) so it reverts to the previous order.
  const handleReorderRoles = async (roleIds: string[]): Promise<boolean> => {
    setRoleReorderBusy(true)
    setRolesError("")
    try {
      const reordered = await reorderRoles(activeServer, roleIds)
      setRolesList(reordered)
      return true
    } catch (err) {
      // 403: missing MANAGE_ROLES/ADMINISTRATOR, or a hierarchy violation (moving
      // a role to/above the caller's own level). 422: the list no longer matches
      // the server's roles (changed/incomplete/duplicated).
      if (err instanceof ApiError && err.status === 403) {
        setRolesError("No podés mover roles que estén a tu nivel o por encima del tuyo, o no tenés permisos para reordenar.")
      } else if (err instanceof ApiError && err.status === 422) {
        setRolesError("La lista de roles cambió. Volvé a abrir el modal e intentá de nuevo.")
      } else {
        setRolesError(friendlyError(err))
      }
      return false
    } finally {
      setRoleReorderBusy(false)
    }
  }

  // HU-3: open the per-member role selector. Loads every server role plus the
  // member's current roles (so the boxes pre-check), mirroring openRoles. Mock
  // servers have no real roles, so the selector opens empty.
  const openMemberRoles = async (memberId: string, memberName: string) => {
    setMemberRolesOpen(true)
    setMemberRolesTarget({ id: memberId, name: memberName })
    setMemberRolesError("")
    setMemberRoleBusyId("")
    setMemberRolesList([])
    setMemberAssignedIds([])
    if (!isRealServerId(activeServer)) return
    setMemberRolesLoading(true)
    try {
      const [all, assigned] = await Promise.all([
        getServerRoles(activeServer),
        getMemberRoles(activeServer, memberId),
      ])
      setMemberRolesList(all)
      setMemberAssignedIds(assigned.map((r) => r.id))
    } catch (err) {
      setMemberRolesError(friendlyError(err))
      setMemberRolesList([])
    } finally {
      setMemberRolesLoading(false)
    }
  }

  // HU-8: open the read-only "ver miembros por rol" list. Loads the members that
  // have the role, mirroring openRoles/openMemberRoles. Mock servers have no real
  // roles, so the list opens empty.
  const openRoleMembers = async (role: ServerRole) => {
    setRoleMembersOpen(true)
    setRoleMembersTarget({ id: role.id, name: role.name })
    setRoleMembersError("")
    setRoleMembersList([])
    if (!isRealServerId(activeServer)) return
    setRoleMembersLoading(true)
    try {
      const members = await getRoleMembers(activeServer, role.id)
      setRoleMembersList(members)
    } catch (err) {
      setRoleMembersError(viewRoleMembersError(err))
      setRoleMembersList([])
    } finally {
      setRoleMembersLoading(false)
    }
  }

  // HU-3: assign (PUT) or remove (DELETE) a role for the open member. Returns
  // true on success so the modal keeps its optimistic checkbox; false (403/other)
  // so it reverts. Member permissions are the backend-computed union of their
  // roles, so nothing is computed here. When the modified member is the current
  // user, their flattened admin permissions are refreshed so admin-gated UI
  // (e.g. the Roles shield icon) updates without a screen reload (CA2).
  const handleToggleMemberRole = async (role: ServerRole, assign: boolean): Promise<boolean> => {
    if (!memberRolesTarget) return false
    setMemberRoleBusyId(role.id)
    setMemberRolesError("")
    try {
      if (assign) {
        await assignRoleToMember(activeServer, memberRolesTarget.id, role.id)
      } else {
        await removeRoleFromMember(activeServer, memberRolesTarget.id, role.id)
      }
      if (user?.id && memberRolesTarget.id === user.id) {
        getMemberPermissions(activeServer, user.id)
          .then(setMemberPermissions)
          .catch(() => undefined)
      }
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setMemberRolesError("No tenés permisos para asignar o quitar este rol.")
      } else {
        setMemberRolesError(friendlyError(err))
      }
      return false
    } finally {
      setMemberRoleBusyId("")
    }
  }

  // HU-7: open the per-channel permission editor for the channel being edited.
  // Loads every server role plus the channel's current overwrites (so each role's
  // three-state selectors pre-fill), mirroring openRoles/openMemberRoles. Mock
  // servers have no real channels, so the editor opens empty.
  const openChannelPerms = async () => {
    if (!editChTarget) return
    setChannelPermsTarget({ id: editChTarget.id, name: editChTarget.name })
    setChannelPermsOpen(true)
    setChannelPermsError("")
    setChannelPermsBusyId("")
    setChannelPermsList([])
    setChannelOverwrites([])
    if (!isRealServerId(activeServer)) return
    setChannelPermsLoading(true)
    try {
      const [rolesList, overwrites] = await Promise.all([
        getServerRoles(activeServer),
        getChannelOverwrites(activeServer, editChTarget.id),
      ])
      setChannelPermsList(rolesList)
      setChannelOverwrites(overwrites)
    } catch (err) {
      setChannelPermsError(friendlyError(err))
      setChannelPermsList([])
    } finally {
      setChannelPermsLoading(false)
    }
  }

  // HU-7: create/replace a role's overwrite for the open channel with the COMPLETE
  // allow/deny lists. The backend deletes the overwrite when both are empty, so
  // the local list drops the role in that case and upserts it otherwise (no
  // reload). Returns true on success so the modal collapses the editor; false
  // (403/404/422/other) so it reverts the draft to the role's loaded state.
  const handleSaveChannelOverwrite = async (
    role: ServerRole,
    allow: string[],
    deny: string[],
  ): Promise<boolean> => {
    if (!channelPermsTarget) return false
    setChannelPermsBusyId(role.id)
    setChannelPermsError("")
    try {
      await setChannelOverwrite(activeServer, channelPermsTarget.id, role.id, allow, deny)
      setChannelOverwrites((prev) => {
        const rest = prev.filter((o) => o.roleId !== role.id)
        // Both empty -> the backend deleted the overwrite; drop it locally too.
        if (allow.length === 0 && deny.length === 0) return rest
        return [...rest, { roleId: role.id, allow, deny }]
      })
      return true
    } catch (err) {
      setChannelPermsError(channelOverwriteError(err))
      return false
    } finally {
      setChannelPermsBusyId("")
    }
  }

  // HU-7: drop a role's overwrite for the open channel (back to all-inherit). On
  // success the role leaves the local overwrites list (no reload). Returns true on
  // success so the modal collapses the editor; false so it stays open.
  const handleRemoveChannelOverwrite = async (role: ServerRole): Promise<boolean> => {
    if (!channelPermsTarget) return false
    setChannelPermsBusyId(role.id)
    setChannelPermsError("")
    try {
      await deleteChannelOverwrite(activeServer, channelPermsTarget.id, role.id)
      setChannelOverwrites((prev) => prev.filter((o) => o.roleId !== role.id))
      return true
    } catch (err) {
      setChannelPermsError(channelOverwriteError(err))
      return false
    } finally {
      setChannelPermsBusyId("")
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const msg = await sendMessage(activeChannel, input.trim(), user?.name)
    setMessages((prev) => [...prev, msg])
    setInput("")
  }

  const openAddModal = (mode: "create" | "join") => {
    setAddMode(mode)
    setServerName("")
    setServerIcon(null)
    setIconLabel("")
    setCreateError("")
    setJoinInput("")
    setJoinError("")
    setJoinNotice("")
    setAddModalOpen(true)
  }

  const handlePickIcon = async () => {
    setCreateError("")
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setCreateError("Necesitamos permiso para acceder a tus fotos.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset) return
    if (Platform.OS === "web") {
      const blob = await (await fetch(asset.uri)).blob()
      setServerIcon(blob)
    } else {
      setServerIcon({
        uri: asset.uri,
        name: asset.fileName ?? "icon.jpg",
        type: asset.mimeType ?? "image/jpeg",
      })
    }
    setIconLabel(asset.fileName ?? "Ícono seleccionado")
  }

  const handleCreateServer = async () => {
    const name = serverName.trim()
    if (name === "") {
      setCreateError("Poné un nombre para el servidor.")
      return
    }
    setCreateBusy(true)
    setCreateError("")
    try {
      const created = await createServer(name, serverIcon)
      setServers((prev) => [...prev, created])
      setActiveServer(created.id)
      setAddModalOpen(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setCreateError(
          "El almacenamiento de íconos no está disponible ahora. Probá de nuevo sin ícono en un rato.",
        )
      } else {
        setCreateError(friendlyError(err))
      }
    } finally {
      setCreateBusy(false)
    }
  }

  const handleJoin = async () => {
    const code = joinInput.trim().split("/").filter(Boolean).pop() ?? ""
    if (code === "") {
      setJoinError("Pegá un código o link de invitación.")
      return
    }
    setJoinBusy(true)
    setJoinError("")
    setJoinNotice("")
    try {
      const { server, joined } = await joinServer(code)
      setServers((prev) =>
        prev.some((s) => s.id === server.id) ? prev : [...prev, server],
      )
      setActiveServer(server.id)
      if (!joined) {
        setJoinNotice("Ya eras miembro de este servidor.")
      } else {
        setAddModalOpen(false)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setJoinError("No existe una invitación con ese código.")
      } else if (err instanceof ApiError && err.status === 403) {
        setJoinError("Estás baneado de este servidor.")
      } else {
        setJoinError(friendlyError(err))
      }
    } finally {
      setJoinBusy(false)
    }
  }

  // CA4: (re)load the active invites shown in the modal.
  const refreshInvites = async (serverId: string) => {
    setInvitesLoading(true)
    setInvitesError("")
    try {
      const list = await listInvites(serverId)
      setActiveInvites(list)
    } catch (err) {
      setInvitesError(friendlyError(err))
      setActiveInvites([])
    } finally {
      setInvitesLoading(false)
    }
  }

  // Opens the invite modal. No invite is generated on open anymore (CA1): the
  // user first picks expiration/usage, then presses "Generar invitación". The
  // active-invites list (CA4) loads immediately for real servers.
  const handleGenerateInvite = () => {
    setInviteOpen(true)
    setInvite(null)
    setInviteError("")
    setCopied(false)
    setInviteExpires(null)
    setInviteMaxUses(null)
    setActiveInvites([])
    setInvitesError("")
    if (!isRealServerId(activeServer)) {
      setInviteError(MOCK_SERVER_NOTICE)
      return
    }
    refreshInvites(activeServer)
  }

  // CA1: generate an invite with the chosen expiration + usage limit.
  const handleCreateInvite = async () => {
    setInvite(null)
    setInviteError("")
    setCopied(false)
    if (!isRealServerId(activeServer)) {
      setInviteError(MOCK_SERVER_NOTICE)
      return
    }
    setInviteBusy(true)
    try {
      const result = await createInvite(activeServer, {
        expiresInSeconds: inviteExpires,
        maxUses: inviteMaxUses,
      })
      setInvite(result)
      // Reflect the new invite in the active list right away.
      refreshInvites(activeServer)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setInviteError("No sos miembro de este servidor.")
      } else if (err instanceof ApiError && err.status === 404) {
        setInviteError("El servidor ya no existe.")
      } else {
        setInviteError(friendlyError(err))
      }
    } finally {
      setInviteBusy(false)
    }
  }

  // CA4: revoke an invite, then drop it from the list.
  const handleRevokeInvite = async (inviteId: string) => {
    setInvitesError("")
    setRevokingId(inviteId)
    try {
      await revokeInvite(activeServer, inviteId)
      setActiveInvites((prev) => prev.filter((i) => i.id !== inviteId))
      // If the just-generated invite was the one revoked, clear its display too.
      setInvite((current) => (current && current.id === inviteId ? null : current))
    } catch (err) {
      setInvitesError(friendlyError(err))
    } finally {
      setRevokingId(null)
    }
  }

  const handleCopyInvite = async () => {
    if (!invite) return
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(invite.url)
      } else {
        await Clipboard.setStringAsync(invite.url)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setInviteError("No pudimos copiar el link. Copialo manualmente.")
    }
  }

  // ---- Channel delete --------------------------------------------------------

  const openDeleteChannel = (ch: { id: string; name: string }) => {
    setDeleteChTarget(ch)
    setDeleteChError("")
    setDeleteChOpen(true)
  }

  const handleDeleteChannel = async () => {
    if (!deleteChTarget || !isRealServerId(activeServer)) return
    setDeleteChBusy(true)
    setDeleteChError("")
    try {
      await deleteChannel(activeServer, deleteChTarget.id)
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          channels: cat.channels.filter((ch) => ch.id !== deleteChTarget.id),
        })),
      )
      if (activeChannel === deleteChTarget.id) {
        const firstText = categories
          .flatMap((c) => c.channels)
          .find((c) => c.id !== deleteChTarget.id && c.type === "text")
        setActiveChannel(firstText?.id ?? "")
      }
      setDeleteChOpen(false)
    } catch (err) {
      setDeleteChError(friendlyError(err))
    } finally {
      setDeleteChBusy(false)
    }
  }

  // ---- Channel edit ---------------------------------------------------------

  const openEditChannel = (ch: { id: string; name: string; topic?: string | null }) => {
    setEditChTarget(ch)
    setEditChName(ch.name)
    setEditChTopic(ch.topic ?? "")
    setEditChError("")
    setEditChOpen(true)
  }

  const handleEditChannel = async () => {
    if (!editChTarget || !isRealServerId(activeServer)) return
    const trimmedName = editChName.trim()
    if (!trimmedName) {
      setEditChError("El nombre no puede estar vacío.")
      return
    }
    setEditChBusy(true)
    setEditChError("")
    try {
      const data: { name?: string; topic?: string | null } = {}
      if (trimmedName !== editChTarget.name) data.name = trimmedName
      const newTopic = editChTopic.trim() || null
      const oldTopic = editChTarget.topic ?? null
      if (newTopic !== oldTopic) data.topic = newTopic

      if (Object.keys(data).length === 0) {
        setEditChOpen(false)
        return
      }

      const updated = await updateChannel(activeServer, editChTarget.id, data)
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          channels: cat.channels.map((ch) =>
            ch.id === editChTarget.id
              ? { ...ch, name: updated.name, topic: updated.topic }
              : ch,
          ),
        })),
      )
      setEditChOpen(false)
    } catch (err) {
      setEditChError(friendlyError(err))
    } finally {
      setEditChBusy(false)
    }
  }

  // ---- Channel create --------------------------------------------------------

  const openCreateChannel = () => {
    setCreateChName("")
    setCreateChType("text")
    setCreateChError("")
    setCreateChOpen(true)
  }

  const handleCreateChannel = async () => {
    if (!isRealServerId(activeServer)) return
    const trimmedName = createChName.trim()
    if (!trimmedName) {
      setCreateChError("Poné un nombre para el canal.")
      return
    }
    // Local duplicate check
    const allChannels = categories.flatMap((c) => c.channels)
    if (allChannels.some((ch) => ch.name.toLowerCase() === trimmedName.toLowerCase())) {
      setCreateChError("Ya existe un canal con ese nombre.")
      return
    }
    setCreateChBusy(true)
    setCreateChError("")
    try {
      const created = await createChannel(activeServer, { name: trimmedName, type: createChType })
      setCategories((prev) => {
        if (prev.length === 0) {
          return [{ id: `${activeServer}:channels`, name: "Canales", channels: [{ id: created.id, name: created.name, type: created.type, topic: created.topic }] }]
        }
        // Append to the last category
        return prev.map((cat, i) =>
          i === prev.length - 1
            ? { ...cat, channels: [...cat.channels, { id: created.id, name: created.name, type: created.type, topic: created.topic }] }
            : cat,
        )
      })
      setActiveChannel(created.id)
      setCreateChOpen(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCreateChError("Ya existe un canal con ese nombre.")
      } else if (err instanceof ApiError && err.status === 403) {
        setCreateChError("No tenés permisos para crear canales.")
      } else {
        setCreateChError(friendlyError(err))
      }
    } finally {
      setCreateChBusy(false)
    }
  }

  // ---- Channel reorder ------------------------------------------------------

  const handleMoveChannel = async (channelId: string, direction: "up" | "down") => {
    if (!isRealServerId(activeServer)) return
    const allChannels = categories.flatMap((c) => c.channels)
    const idx = allChannels.findIndex((c) => c.id === channelId)
    if (idx < 0) return
    const targetIdx = direction === "up" ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= allChannels.length) return

    // Swap locally for instant feedback
    const reordered = [...allChannels]
    ;[reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]]

    // Update categories with the new flat order (single category)
    setCategories((prev) => {
      const flat = prev.flatMap((c) => c.channels)
      const swapped = [...flat]
      const i = swapped.findIndex((c) => c.id === channelId)
      const ti = direction === "up" ? i - 1 : i + 1
      if (i < 0 || ti < 0 || ti >= swapped.length) return prev
      ;[swapped[i], swapped[ti]] = [swapped[ti], swapped[i]]
      // Rebuild categories preserving structure
      let cursor = 0
      return prev.map((cat) => {
        const channels = swapped.slice(cursor, cursor + cat.channels.length)
        cursor += cat.channels.length
        return { ...cat, channels }
      })
    })

    // Persist to backend
    const ids = reordered.map((c) => c.id)
    try {
      await reorderChannels(activeServer, ids)
    } catch {
      // Revert on failure by re-fetching
      const cats = await getCategories(activeServer)
      setCategories(cats)
    }
  }

  const openLeaveModal = () => {
    setLeaveError("")
    setLeaveOpen(true)
  }

  // NOTE: Leaving only works against real servers (created/joined). Mock rail
  // servers ("1".."4") are short-circuited before hitting the backend so the
  // user gets a clear notice instead of a confusing 404/422.
  const handleLeaveServer = async () => {
    setLeaveError("")
    if (!isRealServerId(activeServer)) {
      setLeaveError(MOCK_SERVER_NOTICE)
      return
    }
    setLeaveBusy(true)
    try {
      await leaveServer(activeServer)
      const remaining = servers.filter((s) => s.id !== activeServer)
      setServers((prev) => prev.filter((s) => s.id !== activeServer))
      if (remaining.length > 0) {
        setActiveServer(remaining[0].id)
      }
      setLeaveOpen(false)
    } catch (err) {
      setLeaveError(friendlyError(err))
    } finally {
      setLeaveBusy(false)
    }
  }

  // CA1: a row of selectable pills for a numeric-or-null option (expiration /
  // usage limit), matching the app's teal-accent segmented style.
  const renderInvitePills = (
    options: { label: string; value: number | null }[],
    current: number | null,
    onSelect: (value: number | null) => void,
  ) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
      {options.map((opt) => {
        const selected = current === opt.value
        return (
          <PressableScale
            key={opt.label}
            onPress={() => onSelect(opt.value)}
            pressedScale={0.96}
            hoverStyle={selected ? undefined : { backgroundColor: "rgba(255,255,255,0.08)" }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: selected ? "#37D6C0" : "rgba(255,255,255,0.13)",
              backgroundColor: selected ? "rgba(55,214,192,0.16)" : "rgba(255,255,255,0.04)",
            }}
          >
            <Text style={{ color: selected ? "#37D6C0" : "#8DA8AC", fontSize: 12.5, fontWeight: "700" }}>
              {opt.label}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {/* Server rail */}
      <View
        style={{
          alignItems: "center",
          paddingTop: 8,
          paddingBottom: 8,
          gap: 8,
          width: 52,
          backgroundColor: "rgba(255,255,255,0.15)",
          borderRightWidth: 1,
          borderRightColor: "rgba(255,255,255,0.13)",
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", gap: 8 }}>
          {servers.map((s) => (
            <View
              key={s.id}
              {...(Platform.OS === "web"
                ? { onMouseEnter: showTooltip(s.name), onMouseLeave: hideTooltip }
                : {})}
            >
              {activeServer === s.id && (
                <View
                  style={{ position: "absolute", backgroundColor: "#37D6C0", borderTopRightRadius: 2, borderBottomRightRadius: 2, left: -11, top: 6, bottom: 6, width: 3 }}
                />
              )}
              <PressableScale
                onPress={() => setActiveServer(s.id)}
                accessibilityLabel={s.name}
                pressedScale={0.88}
                hoverStyle={{ borderColor: "rgba(55,214,192,0.55)" }}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 15,
                  backgroundColor: s.iconUrl
                    ? "transparent"
                    : activeServer === s.id
                      ? "#37D6C0"
                      : "rgba(255,255,255,0.10)",
                  borderWidth: 1,
                  borderColor: activeServer === s.id ? "#37D6C0" : "rgba(255,255,255,0.13)",
                }}
              >
                {s.iconUrl ? (
                  <Image
                    source={{ uri: s.iconUrl }}
                    style={{ width: 34, height: 34, borderRadius: 15 }}
                  />
                ) : (
                  <Text
                    style={{
                      fontWeight: "800",
                      fontSize: 12,
                      color: activeServer === s.id ? "#04211D" : "#E6F3F3",
                    }}
                  >
                    {s.abbr}
                  </Text>
                )}
                {s.mention ? (
                  <View
                    style={{
                      position: "absolute",
                      right: -4,
                      bottom: -4,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#FF7F72",
                      borderRadius: 9999,
                      minWidth: 15,
                      height: 15,
                      paddingHorizontal: 4,
                      borderWidth: 2,
                      borderColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>
                      {s.mention}
                    </Text>
                  </View>
                ) : null}
              </PressableScale>
            </View>
          ))}
          <View
            {...(Platform.OS === "web"
              ? { onMouseEnter: showTooltip("Agregar servidor"), onMouseLeave: hideTooltip }
              : {})}
          >
            <PressableScale
              onPress={() => openAddModal("create")}
              accessibilityLabel="Agregar servidor"
              pressedScale={0.88}
              hoverStyle={{ backgroundColor: "rgba(55,214,192,0.14)", borderColor: "rgba(55,214,192,0.55)" }}
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 15,
                backgroundColor: "rgba(255,255,255,0.10)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.13)",
              }}
            >
              <Text style={{ color: "#37D6C0", fontSize: 18 }}>+</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </View>

      {/* Server rail hover tooltip (web only) */}
      {Platform.OS === "web" && tooltip ? (
        <View
          pointerEvents="none"
          style={
            {
              position: "fixed",
              left: 58,
              top: tooltip.y,
              marginTop: -14,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: "#04211D",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
              zIndex: 50,
              maxWidth: 240,
            } as any
          }
        >
          <Text style={{ color: "#E6F3F3", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
            {tooltip.label}
          </Text>
        </View>
      ) : null}

      {isNarrow && channelSidebarOpen ? (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setChannelSidebarOpen(false)}
          accessibilityLabel="Cerrar lista de canales"
          style={{ position: "absolute", left: 52, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 30 }}
        />
      ) : null}

      {/* Channel sidebar */}
      {!isNarrow || channelSidebarOpen ? (
      <View
        style={{
          width: isNarrow ? Math.min(240, screenWidth - 52) : 180,
          backgroundColor: isNarrow ? "#151D23" : "rgba(255,255,255,0.055)",
          borderRightWidth: 1,
          borderRightColor: "rgba(255,255,255,0.13)",
          ...(isNarrow
            ? ({ position: "absolute", left: 52, top: 0, bottom: 0, zIndex: 31 } as object)
            : {}),
        }}
      >
        {/* Server name header: name on its own row so long names stay readable,
            actions on a compact row underneath. */}
        <View
          style={{ paddingHorizontal: 12, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.13)" }}
        >
          {/* HU-4 (#95): the server banner, shown to every member once set. */}
          {activeServerBannerUrl ? (
            <Image
              source={{ uri: activeServerBannerUrl }}
              style={{ width: "100%", height: 72, borderRadius: 8 }}
              resizeMode="cover"
            />
          ) : null}
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }} numberOfLines={2}>
            {servers.find((s) => s.id === activeServer)?.name ?? ""}
          </Text>
          {/* Primary actions — available to every member. Invitar grows to
              anchor the row; Salir keeps its natural width beside it. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <PressableScale
              onPress={handleGenerateInvite}
              hoverStyle={{ backgroundColor: "rgba(55,214,192,0.22)" }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "rgba(55,214,192,0.12)",
              }}
            >
              <Ionicons name="person-add-outline" size={13} color="#37D6C0" />
              <Text style={{ color: "#37D6C0", fontSize: 11.5, fontWeight: "700" }}>Invitar</Text>
            </PressableScale>
            <PressableScale
              onPress={openLeaveModal}
              accessibilityLabel="Salir del servidor"
              hoverStyle={{ backgroundColor: "rgba(255,127,114,0.14)" }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Ionicons name="exit-outline" size={13} color="#8DA8AC" />
              <Text style={{ color: "#8DA8AC", fontSize: 11.5, fontWeight: "600" }}>Salir</Text>
            </PressableScale>
          </View>
          {/* Admin tools — banner config (#95), roles (#92), delete server
              (#97). Rendered as a separate row of uniform square icon buttons
              so they never overflow the sidebar, and only when the member can
              see at least one of them, so the row is never empty. */}
          {canManageRoles || (isOwner && isRealServerId(activeServer)) ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {canAdministrate ? (
                <PressableScale
                  onPress={openSettings}
                  accessibilityLabel="Configuración del servidor"
                  hoverStyle={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                  style={{
                    width: 34,
                    height: 30,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  <Ionicons name="settings-outline" size={15} color="#8DA8AC" />
                </PressableScale>
              ) : null}
              {canManageRoles ? (
                <PressableScale
                  onPress={openRoles}
                  accessibilityLabel="Roles del servidor"
                  hoverStyle={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                  style={{
                    width: 34,
                    height: 30,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  <Ionicons name="shield-outline" size={15} color="#8DA8AC" />
                </PressableScale>
              ) : null}
              {isOwner && isRealServerId(activeServer) ? (
                <PressableScale
                  onPress={openDeleteServer}
                  accessibilityLabel="Eliminar servidor"
                  hoverStyle={{ backgroundColor: "rgba(255,127,114,0.22)" }}
                  style={{
                    width: 34,
                    height: 30,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    backgroundColor: "rgba(255,127,114,0.12)",
                  }}
                >
                  <Ionicons name="trash-outline" size={15} color="#FF7F72" />
                </PressableScale>
              ) : null}
            </View>
          ) : null}
        </View>

        <ScrollView style={{ flex: 1 }}>
          {categories.map((cat) => (
            <View key={cat.id}>
              <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: "#8DA8AC", fontWeight: "700", textTransform: "uppercase", fontSize: 9.5, letterSpacing: 1.3 }}>
                  {cat.name}
                </Text>
                {isOwner && isRealServerId(activeServer) ? (
                  <PressableScale
                    onPress={openCreateChannel}
                    accessibilityLabel="Crear canal"
                    hoverStyle={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                    style={{ padding: 3, borderRadius: 6 }}
                  >
                    <Ionicons name="add" size={14} color="#8DA8AC" />
                  </PressableScale>
                ) : null}
              </View>
              {cat.channels.map((ch) => {
                const active = activeChannel === ch.id
                return (
                  <PressableScale
                    key={ch.id}
                    onPress={() => setActiveChannel(ch.id)}
                    pressedScale={1}
                    hoverStyle={active ? undefined : { backgroundColor: "rgba(255,255,255,0.05)" }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: active ? "rgba(55,214,192,0.15)" : "transparent",
                      borderLeftWidth: 2,
                      borderLeftColor: active ? "#37D6C0" : "transparent",
                    }}
                  >
                    <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 11, opacity: 0.7 }}>
                      {ch.type === "voice" ? "♪" : "#"}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: active || ch.unread ? "#E6F3F3" : "#8DA8AC",
                        fontWeight: active || ch.unread ? "600" : "400",
                      }}
                      numberOfLines={1}
                    >
                      {ch.name}
                    </Text>
                    {isOwner && isRealServerId(activeServer) && active ? (
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        <PressableScale
                          onPress={() => handleMoveChannel(ch.id, "up")}
                          accessibilityLabel={`Mover canal ${ch.name} arriba`}
                          hoverStyle={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                          style={{ padding: 3, borderRadius: 6 }}
                        >
                          <Ionicons name="chevron-up" size={11} color="#8DA8AC" />
                        </PressableScale>
                        <PressableScale
                          onPress={() => handleMoveChannel(ch.id, "down")}
                          accessibilityLabel={`Mover canal ${ch.name} abajo`}
                          hoverStyle={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                          style={{ padding: 3, borderRadius: 6 }}
                        >
                          <Ionicons name="chevron-down" size={11} color="#8DA8AC" />
                        </PressableScale>
                        <PressableScale
                          onPress={() => openEditChannel(ch)}
                          accessibilityLabel={`Editar canal ${ch.name}`}
                          hoverStyle={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                          style={{ padding: 3, borderRadius: 6 }}
                        >
                          <Ionicons name="pencil-outline" size={11} color="#8DA8AC" />
                        </PressableScale>
                        <PressableScale
                          onPress={() => openDeleteChannel(ch)}
                          accessibilityLabel={`Eliminar canal ${ch.name}`}
                          hoverStyle={{ backgroundColor: "rgba(255,127,114,0.14)" }}
                          style={{ padding: 3, borderRadius: 6 }}
                        >
                          <Ionicons name="trash-outline" size={11} color="#FF9E94" />
                        </PressableScale>
                      </View>
                    ) : null}
                    {ch.mention ? (
                      <View style={{ backgroundColor: "#FF7F72", borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>
                          {ch.mention}
                        </Text>
                      </View>
                    ) : null}
                  </PressableScale>
                )
              })}
            </View>
          ))}
        </ScrollView>

        {/* Voice state bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.13)",
            backgroundColor: "rgba(255,255,255,0.15)",
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: "#4FD69C" }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#4FD69C", fontWeight: "700", fontSize: 11 }}>Conectado</Text>
            <Text style={{ color: "#8DA8AC", fontSize: 10 }} numberOfLines={1}>
              Sala 1 · 3 personas
            </Text>
          </View>
        </View>
      </View>
      ) : null}

      {/* Chat main */}
      <View style={{ flex: 1 }}>
        {/* Channel header */}
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.13)" }}
        >
          {isNarrow ? (
            <TouchableOpacity
              onPress={() => {
                setShowMembers(false)
                setChannelSidebarOpen((o) => !o)
              }}
              accessibilityLabel="Mostrar canales"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Ionicons name="menu" size={18} color="#8DA8AC" />
            </TouchableOpacity>
          ) : null}
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 13.5 }}>
            {channel ? `# ${channel.name}` : activeServer ? "Sin canales" : "Inicio"}
          </Text>
          <Text style={{ color: "#8DA8AC", flex: 1, marginLeft: 8, fontSize: 11 }} numberOfLines={1}>
            {servers.find((s) => s.id === activeServer)?.name ?? ""}
          </Text>
          {activeServer ? (
          <TouchableOpacity
            onPress={() => {
              if (isNarrow) setChannelSidebarOpen(false)
              setShowMembers((o) => !o)
            }}
            accessibilityLabel="Mostrar u ocultar miembros"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: showMembers ? "rgba(55,214,192,0.14)" : "rgba(255,255,255,0.05)",
            }}
          >
            <Ionicons
              name={showMembers ? "people" : "people-outline"}
              size={14}
              color={showMembers ? "#37D6C0" : "#8DA8AC"}
            />
            <Text style={{ color: showMembers ? "#37D6C0" : "#8DA8AC", fontSize: 11.5, fontWeight: "600" }}>
              Miembros
            </Text>
          </TouchableOpacity>
          ) : null}
        </View>

        {/* HU-7: recipient banner — offered ownership of this server */}
        {isTransferRecipient ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: "rgba(55,214,192,0.12)",
              borderBottomWidth: 1,
              borderBottomColor: "rgba(55,214,192,0.30)",
            }}
          >
            <Ionicons name="swap-horizontal" size={18} color="#37D6C0" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#E6F3F3", fontSize: 12.5, fontWeight: "700" }}>
                Te transfieren la propiedad de este servidor
              </Text>
              {bannerError ? (
                <Text style={{ color: "#FF9E94", fontSize: 11.5, marginTop: 2 }}>{bannerError}</Text>
              ) : null}
            </View>
            <PressableScale
              onPress={handleAcceptTransfer}
              disabled={transferActionBusy}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "#37D6C0",
                opacity: transferActionBusy ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 11.5 }}>Aceptar</Text>
            </PressableScale>
            <PressableScale
              onPress={handleRejectTransfer}
              disabled={transferActionBusy}
              hoverStyle={{ backgroundColor: "rgba(255,127,114,0.14)" }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.13)",
                backgroundColor: "rgba(255,255,255,0.05)",
                opacity: transferActionBusy ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 11.5 }}>Rechazar</Text>
            </PressableScale>
          </View>
        ) : isTransferSender ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: "rgba(240,194,75,0.10)",
              borderBottomWidth: 1,
              borderBottomColor: "rgba(240,194,75,0.30)",
            }}
          >
            <Ionicons name="hourglass-outline" size={18} color="#F0C24B" />
            <Text style={{ flex: 1, color: "#E6F3F3", fontSize: 12.5, fontWeight: "600" }}>
              Transferencia enviada. Queda pendiente de que la persona destinataria la acepte.
            </Text>
          </View>
        ) : null}

        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={
            messages.length === 0
              ? { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 }
              : { padding: 16, gap: 13 }
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", gap: 10, maxWidth: 320 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 9999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(55,214,192,0.12)",
                }}
              >
                <Ionicons name="chatbubbles-outline" size={26} color="#37D6C0" />
              </View>
              <Text style={{ color: "#E6F3F3", fontSize: 15, fontWeight: "700" }}>
                {activeServer ? "Todavía no hay mensajes" : "No tenés servidores todavía"}
              </Text>
              <Text style={{ color: "#8DA8AC", fontSize: 12.5, textAlign: "center", lineHeight: 18 }}>
                {activeServer
                  ? `Escribí el primero en #${channel?.name ?? "este canal"} y arrancá la conversación.`
                  : "Creá uno con el botón + o unite con una invitación."}
              </Text>
            </View>
          }
          renderItem={({ item: msg }) => {
            const authorInitials = msg.author.split(" ").map((n) => n[0]).join("")
            // Only wire navigation when the message carries a public author id.
            // Mock messages don't, so their authors stay non-tappable for now.
            const goToAuthor = msg.authorId
              ? () => router.push(`/users/${msg.authorId}`)
              : undefined
            return (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={goToAuthor}
                disabled={!goToAuthor}
                accessibilityLabel={goToAuthor ? `Ver perfil de ${msg.author}` : undefined}
              >
                <Avatar initials={authorInitials} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <Text
                    onPress={goToAuthor}
                    accessibilityLabel={goToAuthor ? `Ver perfil de ${msg.author}` : undefined}
                    style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 12.5 }}
                  >
                    {msg.author}
                  </Text>
                  {msg.role ? (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: `${msg.roleColor}22` }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: msg.roleColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {msg.role}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ color: "#8DA8AC", fontSize: 10 }}>{msg.time}</Text>
                  {msg.edited ? <Text style={{ color: "#8DA8AC", fontSize: 9.5 }}>(editado)</Text> : null}
                </View>
                <Text style={{ color: "#E6F3F3", marginTop: 2, fontSize: 12.5 }}>
                  {msg.mentionRole ? (
                    <Text style={{ color: "#37D6C0", fontWeight: "700", backgroundColor: "rgba(55,214,192,0.17)" }}>
                      @{msg.mentionRole}
                    </Text>
                  ) : null}
                  {msg.mentionRole ? " " : ""}{msg.text}
                </Text>
                {msg.reactions ? (
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                    {msg.reactions.map((r) => (
                      <View
                        key={r.emoji}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 8,
                          paddingVertical: 1,
                          borderRadius: 9999,
                          borderWidth: 1,
                          borderColor: r.mine ? "#37D6C0" : "rgba(255,255,255,0.13)",
                          backgroundColor: r.mine ? "rgba(55,214,192,0.17)" : "rgba(255,255,255,0.10)",
                        }}
                      >
                        <Text style={{ fontSize: 10 }}>{r.emoji} </Text>
                        <Text
                          style={{ fontSize: 10, fontWeight: "700", color: r.mine ? "#37D6C0" : "#8DA8AC" }}
                        >
                          {r.count}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
            )
          }}
        />

        {/* Typing indicator: demo, shown only in the example server's #anuncios */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 4, minHeight: 18 }}>
          {activeChannel === "anuncios" ? (
            <Text style={{ color: "#8DA8AC", fontSize: 10.5 }}>Mora está escribiendo…</Text>
          ) : null}
        </View>

        {/* Input */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Text style={{ color: "#8DA8AC", opacity: 0.7 }}>＋</Text>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={`Escribí en #${channel?.name ?? ""}`}
              placeholderTextColor="#5E7E82"
              style={{ flex: 1, color: "#E6F3F3", fontSize: 12 }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <PressableScale
              onPress={handleSend}
              pressedScale={0.92}
              style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}
              hoverStyle={{ backgroundColor: "rgba(55,214,192,0.12)" }}
            >
              <Text style={{ color: "#37D6C0", fontWeight: "600", fontSize: 11 }}>Enviar</Text>
            </PressableScale>
          </View>
        </View>
      </View>

      {isNarrow && showMembers ? (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowMembers(false)}
          accessibilityLabel="Cerrar miembros"
          style={{ position: "absolute", left: 52, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 30 }}
        />
      ) : null}

      {/* Members panel */}
      {showMembers && (
        <View
          style={{
            width: isNarrow ? Math.min(260, screenWidth - 52) : 216,
            backgroundColor: isNarrow ? "#131B21" : "rgba(255,255,255,0.03)",
            borderLeftWidth: 1,
            borderLeftColor: "rgba(255,255,255,0.10)",
            ...(isNarrow
              ? ({ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 31 } as object)
              : {}),
          }}
        >
          {/* Panel header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 14,
              paddingVertical: 13,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255,255,255,0.08)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 13 }}>Miembros</Text>
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "#8DA8AC", fontSize: 11, fontWeight: "700" }}>
                  {roles.reduce((n, r) => n + r.members.length, 0)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowMembers(false)}
              accessibilityLabel="Cerrar miembros"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={17} color="#8DA8AC" />
            </TouchableOpacity>
          </View>

          {roles.length === 0 ? (
            <View style={{ alignItems: "center", paddingHorizontal: 20, paddingTop: 44, gap: 8 }}>
              <Ionicons name="people-outline" size={30} color="#5E7E82" />
              <Text style={{ color: "#E6F3F3", fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                Todavía no hay miembros
              </Text>
              <Text style={{ color: "#8DA8AC", fontSize: 11.5, textAlign: "center", lineHeight: 16 }}>
                Invitá a alguien para empezar a chatear.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}>
              {roles.map((role) => (
                <View key={role.name} style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6, marginBottom: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: role.color }} />
                    <Text style={{ color: "#8DA8AC", fontWeight: "700", textTransform: "uppercase", fontSize: 9.5, letterSpacing: 1.1 }}>
                      {role.name}
                    </Text>
                    <Text style={{ color: "#5E7E82", fontSize: 9.5, fontWeight: "700", marginLeft: "auto" }}>
                      {role.members.length}
                    </Text>
                  </View>
                  {role.members.map((m) => {
                    const nameColor = role.color === "#8DA8AC" ? "#E6F3F3" : role.color
                    const hovered = hoveredMember === m.id
                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => router.push(`/users/${m.id}`)}
                        accessibilityLabel={`Ver perfil de ${m.name}`}
                        {...(Platform.OS === "web"
                          ? {
                              onMouseEnter: () => setHoveredMember(m.id),
                              onMouseLeave: () => setHoveredMember(null),
                            }
                          : {})}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 9,
                          paddingHorizontal: 6,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor: hovered ? "rgba(255,255,255,0.05)" : "transparent",
                          opacity: m.status === "offline" ? 0.55 : 1,
                        }}
                      >
                        <View style={{ position: "relative" }}>
                          <Avatar initials={m.avatar} size={26} />
                          <StatusDot status={m.status} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: nameColor, fontWeight: "600", fontSize: 12.5 }} numberOfLines={1}>
                            {m.name}
                          </Text>
                          <Text style={{ color: "#8DA8AC", fontSize: 10 }} numberOfLines={1}>
                            {STATUS_LABELS[m.status]}
                          </Text>
                        </View>
                        {/* HU-3: admin-only per-member action to assign/remove
                            roles. Gated by canAdministrate — the exact condition
                            that shows the Roles (shield) icon. A separate touchable
                            that stops the press from bubbling to the row's
                            tap-to-open-profile navigation. */}
                        {canManageRoles ? (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation()
                              openMemberRoles(m.id, m.name)
                            }}
                            accessibilityLabel={`Gestionar roles de ${m.name}`}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 8,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "rgba(255,255,255,0.06)",
                            }}
                          >
                            <Ionicons name="shield-outline" size={14} color="#8DA8AC" />
                          </TouchableOpacity>
                        ) : null}
                        {/* HU-7: owner-only per-member action to hand over ownership.
                            A separate touchable that stops the press from bubbling to
                            the row's tap-to-open-profile navigation. */}
                        {canOfferTransferTo(m.id) ? (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation()
                              openTransferForMember(m.id, m.name)
                            }}
                            accessibilityLabel={`Transferir propiedad a ${m.name}`}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 8,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "rgba(55,214,192,0.10)",
                            }}
                          >
                            <Ionicons name="swap-horizontal-outline" size={14} color="#37D6C0" />
                          </TouchableOpacity>
                        ) : null}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Add server modal: create (HU-1) / join (HU-3) */}
      <ModalShell
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Agregar servidor"
        subtitle="Creá tu propio espacio o unite a uno con un link de invitación."
      >
        {/* Segmented control */}
        <View
          style={{
            flexDirection: "row",
            padding: 3,
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 18,
          }}
        >
          {(["create", "join"] as const).map((mode) => {
            const active = addMode === mode
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => setAddMode(mode)}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 8,
                  alignItems: "center",
                  backgroundColor: active ? "rgba(55,214,192,0.16)" : "transparent",
                }}
              >
                <Text style={{ color: active ? "#37D6C0" : "#8DA8AC", fontWeight: "700", fontSize: 12.5 }}>
                  {mode === "create" ? "Crear" : "Unirse"}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {addMode === "create" ? (
          <>
            {createError ? (
              <View style={NOTICE_ERROR}>
                <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{createError}</Text>
              </View>
            ) : null}
            <Text style={LABEL}>Nombre del servidor</Text>
            <TextInput
              value={serverName}
              onChangeText={setServerName}
              placeholder="Ej: FIUBA · IS2"
              placeholderTextColor="#5E7E82"
              maxLength={SERVER_NAME_MAX}
              style={[FIELD, { marginBottom: 16 }]}
            />
            <Text style={LABEL}>Ícono</Text>
            <TouchableOpacity
              onPress={handlePickIcon}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: "rgba(255,255,255,0.16)",
                backgroundColor: "rgba(255,255,255,0.04)",
              }}
            >
              <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(55,214,192,0.14)" }}>
                <Text style={{ color: "#37D6C0", fontSize: 16 }}>＋</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#E6F3F3", fontSize: 12.5, fontWeight: "600" }} numberOfLines={1}>
                  {iconLabel || "Subir una imagen"}
                </Text>
                <Text style={{ color: "#5E7E82", fontSize: 10.5 }}>Opcional · PNG o JPG</Text>
              </View>
              {iconLabel ? (
                <TouchableOpacity
                  onPress={() => { setServerIcon(null); setIconLabel("") }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ color: "#8DA8AC", fontSize: 11, fontWeight: "600" }}>Quitar</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
            <PressableScale
              onPress={handleCreateServer}
              disabled={createBusy}
              style={[PRIMARY_BTN, { marginTop: 18, opacity: createBusy ? 0.7 : 1 }]}
            >
              {createBusy ? <ActivityIndicator color="#04211D" /> : <Text style={PRIMARY_TXT}>Crear servidor</Text>}
            </PressableScale>
          </>
        ) : (
          <>
            {joinError ? (
              <View style={NOTICE_ERROR}>
                <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{joinError}</Text>
              </View>
            ) : null}
            {joinNotice ? (
              <View style={NOTICE_OK}>
                <Text style={{ color: "#37D6C0", fontSize: 12.5 }}>{joinNotice}</Text>
              </View>
            ) : null}
            <Text style={LABEL}>Código o link de invitación</Text>
            <TextInput
              value={joinInput}
              onChangeText={setJoinInput}
              placeholder="Ej: discordia.app/invite/abc123"
              placeholderTextColor="#5E7E82"
              autoCapitalize="none"
              style={[FIELD, { marginBottom: 18 }]}
            />
            <PressableScale
              onPress={handleJoin}
              disabled={joinBusy}
              style={[PRIMARY_BTN, { opacity: joinBusy ? 0.7 : 1 }]}
            >
              {joinBusy ? <ActivityIndicator color="#04211D" /> : <Text style={PRIMARY_TXT}>Unirse</Text>}
            </PressableScale>
          </>
        )}
      </ModalShell>

      {/* Invite panel (HU-2) */}
      <ModalShell
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invitar al servidor"
        subtitle={`Compartí este link para sumar gente a ${servers.find((s) => s.id === activeServer)?.name ?? "este servidor"}.`}
      >
        {!isRealServerId(activeServer) ? (
          <View style={NOTICE_ERROR}>
            <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{inviteError || MOCK_SERVER_NOTICE}</Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {/* CA1: configurable expiration + usage limit */}
            <Text style={LABEL}>Expiración</Text>
            {renderInvitePills(INVITE_EXPIRY_OPTIONS, inviteExpires, setInviteExpires)}
            <Text style={LABEL}>Usos máximos</Text>
            {renderInvitePills(INVITE_MAX_USES_OPTIONS, inviteMaxUses, setInviteMaxUses)}

            <PressableScale
              onPress={handleCreateInvite}
              disabled={inviteBusy}
              style={[PRIMARY_BTN, { marginBottom: 14, opacity: inviteBusy ? 0.7 : 1 }]}
            >
              {inviteBusy ? (
                <ActivityIndicator color="#04211D" />
              ) : (
                <Text style={PRIMARY_TXT}>{invite ? "Generar otra" : "Generar invitación"}</Text>
              )}
            </PressableScale>

            {inviteError ? (
              <View style={NOTICE_ERROR}>
                <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{inviteError}</Text>
              </View>
            ) : null}

            {invite ? (
              <>
                <Text style={LABEL}>Link de invitación</Text>
                <View
                  style={{
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.10)",
                    marginBottom: 8,
                  }}
                >
                  <Text selectable numberOfLines={1} style={{ color: "#E6F3F3", fontSize: 13 }}>
                    {invite.url}
                  </Text>
                </View>
                <Text style={{ color: "#8DA8AC", fontSize: 11.5, marginBottom: 12 }}>
                  {`${formatInviteExpiry(invite.expiresAt)} · ${
                    invite.maxUses == null ? "usos ilimitados" : `hasta ${invite.maxUses} usos`
                  }`}
                </Text>
                <PressableScale onPress={handleCopyInvite} style={PRIMARY_BTN}>
                  <Text style={PRIMARY_TXT}>{copied ? "¡Copiado!" : "Copiar link"}</Text>
                </PressableScale>
              </>
            ) : null}

            {/* CA4: active invites with revoke */}
            <View
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={LABEL}>Invitaciones activas</Text>
              {invitesLoading ? (
                <View style={{ paddingVertical: 16, alignItems: "center" }}>
                  <ActivityIndicator color="#37D6C0" />
                </View>
              ) : invitesError ? (
                <View style={NOTICE_ERROR}>
                  <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{invitesError}</Text>
                </View>
              ) : activeInvites.length === 0 ? (
                <Text style={{ color: "#8DA8AC", fontSize: 12, lineHeight: 17 }}>
                  Todavía no hay invitaciones activas.
                </Text>
              ) : (
                activeInvites.map((inv) => (
                  <View
                    key={inv.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                      borderRadius: 10,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.10)",
                      backgroundColor: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: "#E6F3F3", fontSize: 12.5, fontWeight: "700" }} numberOfLines={1}>
                        {inv.code}
                      </Text>
                      <Text style={{ color: "#8DA8AC", fontSize: 10.5 }} numberOfLines={1}>
                        {`${formatInviteUses(inv)} · ${formatInviteExpiry(inv.expiresAt)}`}
                      </Text>
                    </View>
                    <PressableScale
                      onPress={() => handleRevokeInvite(inv.id)}
                      disabled={revokingId === inv.id}
                      accessibilityLabel={`Revocar invitación ${inv.code}`}
                      hoverStyle={{ backgroundColor: "rgba(255,127,114,0.14)" }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: "rgba(255,127,114,0.10)",
                        opacity: revokingId === inv.id ? 0.6 : 1,
                      }}
                    >
                      {revokingId === inv.id ? (
                        <ActivityIndicator color="#FF9E94" size="small" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={13} color="#FF9E94" />
                          <Text style={{ color: "#FF9E94", fontSize: 11.5, fontWeight: "700" }}>Revocar</Text>
                        </>
                      )}
                    </PressableScale>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </ModalShell>

      {/* Delete-channel confirmation */}
      <ModalShell
        visible={deleteChOpen}
        onClose={() => setDeleteChOpen(false)}
        title="Eliminar canal"
      >
        <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
          ¿Seguro que querés eliminar{" "}
          <Text style={{ color: "#E6F3F3", fontWeight: "700" }}>
            #{deleteChTarget?.name ?? "este canal"}
          </Text>
          ? Se perderá todo su historial de mensajes de forma permanente.
        </Text>

        {deleteChError ? (
          <View style={NOTICE_ERROR}>
            <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{deleteChError}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <PressableScale
            onPress={() => setDeleteChOpen(false)}
            disabled={deleteChBusy}
            hoverStyle={{ backgroundColor: "rgba(255,255,255,0.10)" }}
            style={{
              flex: 1,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }}>Cancelar</Text>
          </PressableScale>
          <PressableScale
            onPress={handleDeleteChannel}
            disabled={deleteChBusy}
            style={{
              flex: 1,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
              backgroundColor: "#FF7F72",
              opacity: deleteChBusy ? 0.7 : 1,
            }}
          >
            {deleteChBusy ? (
              <ActivityIndicator color="#04211D" />
            ) : (
              <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>Eliminar</Text>
            )}
          </PressableScale>
        </View>
      </ModalShell>

      {/* Edit-channel modal */}
      <ModalShell
        visible={editChOpen}
        onClose={() => setEditChOpen(false)}
        title="Editar canal"
      >
        {editChError ? (
          <View style={NOTICE_ERROR}>
            <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{editChError}</Text>
          </View>
        ) : null}

        <Text style={LABEL}>Nombre</Text>
        <TextInput
          value={editChName}
          onChangeText={setEditChName}
          placeholder="nombre-del-canal"
          placeholderTextColor="#5E7E82"
          maxLength={100}
          autoCapitalize="none"
          style={[FIELD, { marginBottom: 14 }]}
        />

        <Text style={LABEL}>Tema (opcional)</Text>
        <TextInput
          value={editChTopic}
          onChangeText={setEditChTopic}
          placeholder="¿De qué se habla en este canal?"
          placeholderTextColor="#5E7E82"
          maxLength={256}
          autoCapitalize="none"
          style={[FIELD, { marginBottom: 18 }]}
        />

        <PressableScale
          onPress={handleEditChannel}
          disabled={editChBusy || !editChName.trim()}
          style={[PRIMARY_BTN, { opacity: editChBusy || !editChName.trim() ? 0.5 : 1 }]}
        >
          {editChBusy ? (
            <ActivityIndicator color="#04211D" />
          ) : (
            <Text style={PRIMARY_TXT}>Guardar</Text>
          )}
        </PressableScale>

        {/* HU-7: per-channel role permission overrides. Admin-only (same
            canAdministrate gate as the role manager); opens its own modal for the
            channel being edited so this one never grows a big inline editor. */}
        {canAdministrate && editChTarget ? (
          <PressableScale
            onPress={openChannelPerms}
            accessibilityLabel="Configurar permisos por rol de este canal"
            hoverStyle={{ backgroundColor: "rgba(55,214,192,0.22)" }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 11,
              borderRadius: 10,
              marginTop: 10,
              backgroundColor: "rgba(55,214,192,0.12)",
            }}
          >
            <Ionicons name="options-outline" size={16} color="#37D6C0" />
            <Text style={{ color: "#37D6C0", fontSize: 13, fontWeight: "700" }}>Permisos por rol</Text>
          </PressableScale>
        ) : null}
      </ModalShell>

      {/* Create-channel modal */}
      <ModalShell
        visible={createChOpen}
        onClose={() => setCreateChOpen(false)}
        title="Crear canal"
      >
        {createChError ? (
          <View style={NOTICE_ERROR}>
            <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{createChError}</Text>
          </View>
        ) : null}

        <Text style={LABEL}>Nombre</Text>
        <TextInput
          value={createChName}
          onChangeText={setCreateChName}
          placeholder="nombre-del-canal"
          placeholderTextColor="#5E7E82"
          maxLength={100}
          autoCapitalize="none"
          style={[FIELD, { marginBottom: 14 }]}
        />

        <Text style={LABEL}>Tipo</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
          <PressableScale
            onPress={() => setCreateChType("text")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: createChType === "text" ? "#37D6C0" : "#1A3A3A",
              backgroundColor: createChType === "text" ? "rgba(55,214,192,0.12)" : "transparent",
              alignItems: "center",
            }}
          >
            <Text style={{ color: createChType === "text" ? "#37D6C0" : "#8DA8AC", fontWeight: "700", fontSize: 15 }}>#</Text>
            <Text style={{ color: createChType === "text" ? "#E6F3F3" : "#8DA8AC", fontSize: 11, marginTop: 2 }}>Texto</Text>
          </PressableScale>
          <PressableScale
            onPress={() => setCreateChType("voice")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: createChType === "voice" ? "#37D6C0" : "#1A3A3A",
              backgroundColor: createChType === "voice" ? "rgba(55,214,192,0.12)" : "transparent",
              alignItems: "center",
            }}
          >
            <Text style={{ color: createChType === "voice" ? "#37D6C0" : "#8DA8AC", fontWeight: "700", fontSize: 15 }}>♪</Text>
            <Text style={{ color: createChType === "voice" ? "#E6F3F3" : "#8DA8AC", fontSize: 11, marginTop: 2 }}>Voz</Text>
          </PressableScale>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <PressableScale
            onPress={() => setCreateChOpen(false)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }}>Cancelar</Text>
          </PressableScale>
          <PressableScale
            onPress={handleCreateChannel}
            disabled={createChBusy || !createChName.trim()}
            style={[PRIMARY_BTN, { flex: 1, opacity: createChBusy || !createChName.trim() ? 0.5 : 1 }]}
          >
            {createChBusy ? (
              <ActivityIndicator color="#04211D" />
            ) : (
              <Text style={PRIMARY_TXT}>Crear canal</Text>
            )}
          </PressableScale>
        </View>
      </ModalShell>

      {/* Leave-server confirmation (HU-5) */}
      <ModalShell
        visible={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Abandonar servidor"
      >
        <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
          ¿Seguro que querés abandonar{" "}
          <Text style={{ color: "#E6F3F3", fontWeight: "700" }}>
            {servers.find((s) => s.id === activeServer)?.name ?? "este servidor"}
          </Text>
          ? Vas a perder el acceso a sus canales.
        </Text>

        {leaveError ? (
          <View style={NOTICE_ERROR}>
            <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{leaveError}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <PressableScale
            onPress={() => setLeaveOpen(false)}
            disabled={leaveBusy}
            hoverStyle={{ backgroundColor: "rgba(255,255,255,0.10)" }}
            style={{
              flex: 1,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }}>Cancelar</Text>
          </PressableScale>
          <PressableScale
            onPress={handleLeaveServer}
            disabled={leaveBusy}
            style={{
              flex: 1,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
              backgroundColor: "#FF7F72",
              opacity: leaveBusy ? 0.7 : 1,
            }}
          >
            {leaveBusy ? (
              <ActivityIndicator color="#04211D" />
            ) : (
              <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>Abandonar</Text>
            )}
          </PressableScale>
        </View>
      </ModalShell>

      {/* Delete-server confirmation (HU-6 / #97) */}
      <DeleteServerModal
        visible={deleteSrvOpen}
        serverName={activeServerName}
        busy={deleteSrvBusy}
        error={deleteSrvError}
        onClose={() => setDeleteSrvOpen(false)}
        onConfirm={handleDeleteServer}
      />

      {/* HU-4 (#95): server settings — banner */}
      <ServerSettingsModal
        visible={settingsOpen}
        serverName={activeServerName}
        currentIconUrl={activeServerIconUrl}
        currentBannerUrl={activeServerBannerUrl}
        busy={settingsBusy}
        error={settingsError}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />

      {/* HU-5 (#92): role manager */}
      <RolesModal
        visible={rolesOpen}
        roles={rolesList}
        defaultRoleId={defaultRoleId}
        loading={rolesLoading}
        error={rolesError}
        busyRoleId={roleBusyId}
        defaultBusyId={roleDefaultBusyId}
        canManageRoles={canManageRoles}
        createBusy={roleCreateBusy}
        updateBusy={roleUpdateBusy}
        reorderBusy={roleReorderBusy}
        isOwner={isOwner}
        ownRolePosition={ownRolePosition}
        onClose={() => setRolesOpen(false)}
        onDelete={handleDeleteRole}
        onSetDefault={handleSetDefaultRole}
        onCreate={handleCreateRole}
        onUpdatePermissions={handleUpdateRolePermissions}
        onReorder={handleReorderRoles}
        onViewMembers={openRoleMembers}
      />

      {/* HU-8: read-only list of members with a given role */}
      <RoleMembersModal
        visible={roleMembersOpen}
        roleName={roleMembersTarget?.name ?? ""}
        members={roleMembersList}
        loading={roleMembersLoading}
        error={roleMembersError}
        onClose={() => setRoleMembersOpen(false)}
      />

      {/* HU-3: per-member role assignment */}
      <MemberRolesModal
        visible={memberRolesOpen}
        memberName={memberRolesTarget?.name ?? ""}
        roles={memberRolesList}
        assignedRoleIds={memberAssignedIds}
        loading={memberRolesLoading}
        error={memberRolesError}
        busyRoleId={memberRoleBusyId}
        onClose={() => setMemberRolesOpen(false)}
        onToggle={handleToggleMemberRole}
      />

      {/* HU-7: per-channel role permission overrides */}
      <ChannelPermissionsModal
        visible={channelPermsOpen}
        channelName={channelPermsTarget?.name ?? ""}
        roles={channelPermsList}
        overwrites={channelOverwrites}
        loading={channelPermsLoading}
        error={channelPermsError}
        busyRoleId={channelPermsBusyId}
        canAdministrate={canAdministrate}
        onClose={() => setChannelPermsOpen(false)}
        onSave={handleSaveChannelOverwrite}
        onRemove={handleRemoveChannelOverwrite}
      />

      {/* Transfer ownership (HU-7) */}
      <ModalShell
        visible={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transferir propiedad"
        subtitle={`Vas a pasarle la propiedad de ${activeServerName || "este servidor"}. Es una acción definitiva.`}
      >
        {transferError ? (
          <View style={NOTICE_ERROR}>
            <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{transferError}</Text>
          </View>
        ) : null}

        <Text style={LABEL}>Nuevo propietario</Text>
        <View
          style={{
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
            marginBottom: 16,
            backgroundColor: "rgba(55,214,192,0.10)",
            borderWidth: 1,
            borderColor: "rgba(55,214,192,0.30)",
          }}
        >
          <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: "700" }} numberOfLines={1}>
            {transferTargetName}
          </Text>
        </View>

        <Text style={LABEL}>Escribí el nombre del servidor para confirmar</Text>
        <TextInput
          value={transferConfirmName}
          onChangeText={setTransferConfirmName}
          placeholder={activeServerName}
          placeholderTextColor="#5E7E82"
          autoCapitalize="none"
          style={[FIELD, { marginBottom: 18 }]}
        />

        <PressableScale
          onPress={handleTransfer}
          disabled={!canTransfer || transferBusy}
          style={[PRIMARY_BTN, { opacity: !canTransfer || transferBusy ? 0.5 : 1 }]}
        >
          {transferBusy ? (
            <ActivityIndicator color="#04211D" />
          ) : (
            <Text style={PRIMARY_TXT}>Transferir</Text>
          )}
        </PressableScale>
      </ModalShell>
    </View>
  )
}
