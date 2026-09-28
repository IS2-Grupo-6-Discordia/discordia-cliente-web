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
import {
  getServers,
  getCategories,
  getRoles,
  getMessages,
  sendMessage,
  createServer,
  createInvite,
  joinServer,
  leaveServer,
} from "@/api"
import type { Server, Category, RoleGroup, Message, Invite } from "@/api/types"
import { ApiError, friendlyError } from "@/api/client"
import { Ionicons } from "@expo/vector-icons"
import Avatar from "@/components/Avatar"
import StatusDot from "@/components/StatusDot"
import ModalShell from "@/components/ModalShell"

const SERVER_NAME_MAX = 100

// Rail servers with non-UUID ids ("1".."4") are mock/example servers. Real
// backend actions (invite, leave...) only make sense against a real server id.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRealServerId(id: string): boolean {
  return UUID_RE.test(id)
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
  const [activeServer, setActiveServer] = useState("1")
  const [activeChannel, setActiveChannel] = useState("general")
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

  // Leave-server confirmation (HU-5)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [leaveError, setLeaveError] = useState("")

  useEffect(() => {
    getServers().then(setServers)
  }, [])

  useEffect(() => {
    getCategories(activeServer).then((cats) => {
      setCategories(cats)
      // Switch focus to the new server's first text channel so we never keep
      // showing the previous server's channel (and its messages).
      const firstText = cats.flatMap((c) => c.channels).find((c) => c.type === "text")
      if (firstText) setActiveChannel(firstText.id)
    })
    getRoles(activeServer).then(setRoles)
  }, [activeServer])

  useEffect(() => {
    getMessages(activeChannel).then(setMessages)
  }, [activeChannel])

  const channel = categories.flatMap((c) => c.channels).find((c) => c.id === activeChannel)

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

  const handleGenerateInvite = async () => {
    setInviteOpen(true)
    setInvite(null)
    setInviteError("")
    setCopied(false)
    if (!isRealServerId(activeServer)) {
      setInviteError(MOCK_SERVER_NOTICE)
      return
    }
    setInviteBusy(true)
    try {
      const result = await createInvite(activeServer)
      setInvite(result)
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
              <TouchableOpacity
                onPress={() => setActiveServer(s.id)}
                accessibilityLabel={s.name}
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
              </TouchableOpacity>
            </View>
          ))}
          <View
            {...(Platform.OS === "web"
              ? { onMouseEnter: showTooltip("Agregar servidor"), onMouseLeave: hideTooltip }
              : {})}
          >
            <TouchableOpacity
              onPress={() => openAddModal("create")}
              accessibilityLabel="Agregar servidor"
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
            </TouchableOpacity>
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
            <TouchableOpacity
              onPress={handleGenerateInvite}
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
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openLeaveModal}
              accessibilityLabel="Salir del servidor"
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
            </TouchableOpacity>
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
                  <TouchableOpacity
                    key={ch.id}
                    onPress={() => setActiveChannel(ch.id)}
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
                  </TouchableOpacity>
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
            # {channel?.name}
          </Text>
          <Text style={{ color: "#8DA8AC", flex: 1, marginLeft: 8, fontSize: 11 }} numberOfLines={1}>
            Coordinación general de la cursada
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

        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 13 }}
          renderItem={({ item: msg }) => (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Avatar initials={msg.author.split(" ").map((n) => n[0]).join("")} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 12.5 }}>{msg.author}</Text>
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
          )}
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
            <TouchableOpacity onPress={handleSend}>
              <Text style={{ color: "#37D6C0", fontWeight: "600", fontSize: 11 }}>Enviar</Text>
            </TouchableOpacity>
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
                      <View
                        key={m.id}
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
                      </View>
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
            <TouchableOpacity
              onPress={handleCreateServer}
              disabled={createBusy}
              style={[PRIMARY_BTN, { marginTop: 18, opacity: createBusy ? 0.7 : 1 }]}
            >
              {createBusy ? <ActivityIndicator color="#04211D" /> : <Text style={PRIMARY_TXT}>Crear servidor</Text>}
            </TouchableOpacity>
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
            <TouchableOpacity
              onPress={handleJoin}
              disabled={joinBusy}
              style={[PRIMARY_BTN, { opacity: joinBusy ? 0.7 : 1 }]}
            >
              {joinBusy ? <ActivityIndicator color="#04211D" /> : <Text style={PRIMARY_TXT}>Unirse</Text>}
            </TouchableOpacity>
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
        {inviteBusy ? (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color="#37D6C0" />
            <Text style={{ color: "#8DA8AC", fontSize: 12.5, marginTop: 10 }}>Generando invitación…</Text>
          </View>
        ) : inviteError ? (
          <View style={NOTICE_ERROR}>
            <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{inviteError}</Text>
          </View>
        ) : invite ? (
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
                marginBottom: 14,
              }}
            >
              <Text selectable numberOfLines={1} style={{ color: "#E6F3F3", fontSize: 13 }}>
                {invite.url}
              </Text>
            </View>
            <TouchableOpacity onPress={handleCopyInvite} style={PRIMARY_BTN}>
              <Text style={PRIMARY_TXT}>{copied ? "¡Copiado!" : "Copiar link"}</Text>
            </TouchableOpacity>
          </>
        ) : null}
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
          <TouchableOpacity
            onPress={() => setLeaveOpen(false)}
            disabled={leaveBusy}
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
          </TouchableOpacity>
          <TouchableOpacity
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
          </TouchableOpacity>
        </View>
      </ModalShell>
    </View>
  )
}
