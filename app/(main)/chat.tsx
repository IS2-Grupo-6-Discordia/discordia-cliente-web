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
} from "react-native"
import type { ViewStyle, TextStyle } from "react-native"
import * as ImagePicker from "expo-image-picker"
import * as Clipboard from "expo-clipboard"
import { useRouter } from "expo-router"
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
  startOwnershipTransfer,
  getPendingTransfer,
  acceptOwnershipTransfer,
  rejectOwnershipTransfer,
} from "@/api"
import type { Server, Category, RoleGroup, Member, ServerMember, Message, Invite, OwnershipTransfer } from "@/api/types"
import { ApiError, friendlyError } from "@/api/client"
import { useAuth } from "@/context/AuthContext"
import { Ionicons } from "@expo/vector-icons"
import Avatar from "@/components/Avatar"
import StatusDot from "@/components/StatusDot"
import ModalShell from "@/components/ModalShell"
import PressableScale from "@/components/PressableScale"

const SERVER_NAME_MAX = 100

// Rail servers with non-UUID ids ("1".."4") are mock/example servers. Real
// backend actions (invite, leave...) only make sense against a real server id.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRealServerId(id: string): boolean {
  return UUID_RE.test(id)
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
// member panel renders. The backend only knows "owner" / "member" and tracks no
// presence, so everyone is shown as online for now (there is no presence service).
function membersToRoleGroups(members: ServerMember[]): RoleGroup[] {
  const toMember = (m: ServerMember, color: string): Member => ({
    id: m.userId,
    name: m.name,
    avatar: m.avatar,
    color,
    status: "online",
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

export default function ChatScreen() {
  const router = useRouter()
  const { user } = useAuth()
  // No server is selected until the real list loads. Never default to a mock id,
  // or the app boots into a phantom server (and its mock channels/messages) even
  // when the user has none.
  const [activeServer, setActiveServer] = useState("")
  const [activeChannel, setActiveChannel] = useState("")
  const [showMembers, setShowMembers] = useState(false)
  const [input, setInput] = useState("")

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

  // Leave-server confirmation (HU-5)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [leaveError, setLeaveError] = useState("")

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
    getServers().then((list) => {
      setServers(list)
      // Land on the first real server the user belongs to. If they have none, no
      // server stays selected and the screen shows its "create or join" state.
      setActiveServer((current) => current || list[0]?.id || "")
    })
  }, [])

  useEffect(() => {
    if (!activeServer) {
      // No server selected (e.g. the user has none): clear everything so no mock
      // channel or roster leaks through.
      setCategories([])
      setRoles([])
      setActiveChannel("")
      return
    }
    getCategories(activeServer).then((cats) => {
      setCategories(cats)
      // Switch focus to the new server's first text channel so we never keep
      // showing the previous server's channel (and its messages).
      const firstText = cats.flatMap((c) => c.channels).find((c) => c.type === "text")
      setActiveChannel(firstText ? firstText.id : "")
    })
    // Real roster from the backend (owner + members), hydrated with names/avatars.
    getServerMembers(activeServer)
      .then((members) => setRoles(membersToRoleGroups(members)))
      .catch(() => setRoles([]))
  }, [activeServer])

  useEffect(() => {
    if (!activeChannel) {
      setMessages([])
      return
    }
    getMessages(activeChannel).then(setMessages)
  }, [activeChannel])

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

  const handleSend = async () => {
    if (!input.trim()) return
    const msg = await sendMessage(activeChannel, input.trim())
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

      {/* Channel sidebar */}
      <View
        style={{
          width: 180,
          backgroundColor: "rgba(255,255,255,0.055)",
          borderRightWidth: 1,
          borderRightColor: "rgba(255,255,255,0.13)",
        }}
      >
        {/* Server name header: name on its own row so long names stay readable,
            actions on a compact row underneath. */}
        <View
          style={{ paddingHorizontal: 12, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.13)" }}
        >
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }} numberOfLines={2}>
            {servers.find((s) => s.id === activeServer)?.name ?? ""}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <PressableScale
              onPress={handleGenerateInvite}
              hoverStyle={{ backgroundColor: "rgba(55,214,192,0.22)" }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
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
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Ionicons name="exit-outline" size={13} color="#8DA8AC" />
              <Text style={{ color: "#8DA8AC", fontSize: 11.5, fontWeight: "600" }}>Salir</Text>
            </PressableScale>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }}>
          {categories.map((cat) => (
            <View key={cat.id}>
              <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
                <Text style={{ color: "#8DA8AC", fontWeight: "700", textTransform: "uppercase", fontSize: 9.5, letterSpacing: 1.3 }}>
                  {cat.name}
                </Text>
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

      {/* Chat main */}
      <View style={{ flex: 1 }}>
        {/* Channel header */}
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.13)" }}
        >
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 13.5 }}>
            {channel ? `# ${channel.name}` : "Discordia"}
          </Text>
          <Text style={{ color: "#8DA8AC", flex: 1, marginLeft: 8, fontSize: 11 }} numberOfLines={1}>
            {servers.find((s) => s.id === activeServer)?.name ?? ""}
          </Text>
          <TouchableOpacity
            onPress={() => setShowMembers((o) => !o)}
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

      {/* Members panel */}
      {showMembers && (
        <View
          style={{
            width: 216,
            backgroundColor: "rgba(255,255,255,0.03)",
            borderLeftWidth: 1,
            borderLeftColor: "rgba(255,255,255,0.10)",
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
                            {m.status === "online" ? "En línea" : m.status === "away" ? "Ausente" : "Desconectado/a"}
                          </Text>
                        </View>
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
