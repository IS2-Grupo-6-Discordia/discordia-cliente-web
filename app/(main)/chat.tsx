import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native"
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
import Avatar from "@/components/Avatar"
import StatusDot from "@/components/StatusDot"

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

export default function ChatScreen() {
  const [activeServer, setActiveServer] = useState("1")
  const [activeChannel, setActiveChannel] = useState("general")
  const [showMembers, setShowMembers] = useState(false)
  const [input, setInput] = useState("")

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
    getCategories(activeServer).then(setCategories)
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
            <View key={s.id}>
              {activeServer === s.id && (
                <View
                  style={{ position: "absolute", backgroundColor: "#37D6C0", borderTopRightRadius: 2, borderBottomRightRadius: 2, left: -11, top: 6, bottom: 6, width: 3 }}
                />
              )}
              <TouchableOpacity
                onPress={() => setActiveServer(s.id)}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 15,
                  backgroundColor: activeServer === s.id ? "#37D6C0" : "rgba(255,255,255,0.10)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.13)",
                }}
              >
                <Text
                  style={{
                    fontWeight: "800",
                    fontSize: 12,
                    color: activeServer === s.id ? "#04211D" : "#E6F3F3",
                  }}
                >
                  {s.abbr}
                </Text>
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
          <TouchableOpacity
            onPress={() => openAddModal("create")}
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
        </ScrollView>
      </View>

      {/* Channel sidebar */}
      <View
        style={{
          width: 180,
          backgroundColor: "rgba(255,255,255,0.055)",
          borderRightWidth: 1,
          borderRightColor: "rgba(255,255,255,0.13)",
        }}
      >
        {/* Server name header */}
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.13)" }}
        >
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14, flex: 1 }} numberOfLines={1}>
            {servers.find((s) => s.id === activeServer)?.name ?? ""}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TouchableOpacity
              onPress={handleGenerateInvite}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.13)",
                backgroundColor: "rgba(55,214,192,0.15)",
              }}
            >
              <Text style={{ color: "#37D6C0", fontSize: 10.5, fontWeight: "700" }}>Invitar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openLeaveModal}
              accessibilityLabel="Salir del servidor"
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: "rgba(255,127,114,0.45)",
                backgroundColor: "rgba(255,127,114,0.15)",
              }}
            >
              <Text style={{ color: "#FF7F72", fontSize: 10.5, fontWeight: "700" }}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }}>
          {categories.map((cat) => (
            <View key={cat.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
                <Text style={{ color: "#8DA8AC", fontWeight: "700", textTransform: "uppercase", fontSize: 9.5, letterSpacing: 1.3 }}>
                  {cat.name}
                </Text>
                <Text style={{ color: "#8DA8AC", fontSize: 9.5 }}>+</Text>
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
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Text style={{ color: "#8DA8AC", fontSize: 10.5 }}>Miembros</Text>
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

        {/* Typing indicator */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          <Text style={{ color: "#8DA8AC", fontSize: 10.5 }}>Mora está escribiendo…</Text>
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
        <ScrollView
          style={{
            width: 170,
            backgroundColor: "rgba(255,255,255,0.055)",
            borderLeftWidth: 1,
            borderLeftColor: "rgba(255,255,255,0.13)",
          }}
          contentContainerStyle={{ padding: 12 }}
        >
          {roles.map((role) => (
            <View key={role.name}>
              <Text style={{ color: "#8DA8AC", fontWeight: "700", textTransform: "uppercase", marginTop: 12, marginBottom: 6, fontSize: 9.5, letterSpacing: 1.2 }}>
                {role.name} — {role.members.length}
              </Text>
              {role.members.map((m) => (
                <View
                  key={m.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, opacity: m.status === "offline" ? 0.55 : 1 }}
                >
                  <View style={{ position: "relative" }}>
                    <Avatar initials={m.avatar} size={20} />
                    <StatusDot status={m.status} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: "#E6F3F3", fontWeight: "600", fontSize: 11.5 }} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={{ color: "#8DA8AC", fontSize: 9.5 }} numberOfLines={1}>
                      {m.status === "online" ? "En línea" : m.status === "away" ? "Ausente" : "Desconectado/a"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add server modal: create (HU-1) / join (HU-3) */}
      <Modal
        visible={addModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 16,
              padding: 20,
              backgroundColor: "#0A1620",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
            }}
          >
            {/* Tabs */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {(["create", "join"] as const).map((mode) => {
                const active = addMode === mode
                return (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setAddMode(mode)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: active ? "rgba(55,214,192,0.15)" : "rgba(255,255,255,0.055)",
                      borderWidth: 1,
                      borderColor: active ? "#37D6C0" : "rgba(255,255,255,0.13)",
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
                <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 16, marginBottom: 14 }}>
                  Crear servidor
                </Text>
                {createError ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      marginBottom: 12,
                      backgroundColor: "rgba(255,127,114,0.15)",
                      borderWidth: 1,
                      borderColor: "#FF7F72",
                    }}
                  >
                    <Text style={{ color: "#FF7F72", fontSize: 12 }}>{createError}</Text>
                  </View>
                ) : null}
                <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>
                  Nombre del servidor
                </Text>
                <TextInput
                  value={serverName}
                  onChangeText={setServerName}
                  placeholder="Ej: FIUBA · IS2"
                  placeholderTextColor="#5E7E82"
                  maxLength={SERVER_NAME_MAX}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: "#E6F3F3",
                    fontSize: 14,
                    backgroundColor: "rgba(255,255,255,0.10)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.13)",
                    marginBottom: 12,
                  }}
                />
                <TouchableOpacity
                  onPress={handlePickIcon}
                  style={{
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.13)",
                    backgroundColor: "rgba(255,255,255,0.10)",
                  }}
                >
                  <Text style={{ color: "#E6F3F3", fontSize: 12, fontWeight: "600" }}>
                    {iconLabel || "Elegir ícono (opcional)"}
                  </Text>
                </TouchableOpacity>
                {iconLabel ? (
                  <TouchableOpacity onPress={() => { setServerIcon(null); setIconLabel("") }} style={{ marginBottom: 8 }}>
                    <Text style={{ color: "#8DA8AC", fontSize: 11 }}>Quitar ícono</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={handleCreateServer}
                  disabled={createBusy}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: "center",
                    marginTop: 6,
                    backgroundColor: "#37D6C0",
                    opacity: createBusy ? 0.7 : 1,
                  }}
                >
                  {createBusy ? (
                    <ActivityIndicator color="#04211D" />
                  ) : (
                    <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>
                      Crear servidor
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 16, marginBottom: 14 }}>
                  Unirse a un servidor
                </Text>
                {joinError ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      marginBottom: 12,
                      backgroundColor: "rgba(255,127,114,0.15)",
                      borderWidth: 1,
                      borderColor: "#FF7F72",
                    }}
                  >
                    <Text style={{ color: "#FF7F72", fontSize: 12 }}>{joinError}</Text>
                  </View>
                ) : null}
                {joinNotice ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      marginBottom: 12,
                      backgroundColor: "rgba(55,214,192,0.15)",
                      borderWidth: 1,
                      borderColor: "#37D6C0",
                    }}
                  >
                    <Text style={{ color: "#37D6C0", fontSize: 12 }}>{joinNotice}</Text>
                  </View>
                ) : null}
                <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>
                  Código o link de invitación
                </Text>
                <TextInput
                  value={joinInput}
                  onChangeText={setJoinInput}
                  placeholder="Ej: https://discordia.app/invite/abc123"
                  placeholderTextColor="#5E7E82"
                  autoCapitalize="none"
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: "#E6F3F3",
                    fontSize: 14,
                    backgroundColor: "rgba(255,255,255,0.10)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.13)",
                    marginBottom: 12,
                  }}
                />
                <TouchableOpacity
                  onPress={handleJoin}
                  disabled={joinBusy}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: "center",
                    backgroundColor: "#37D6C0",
                    opacity: joinBusy ? 0.7 : 1,
                  }}
                >
                  {joinBusy ? (
                    <ActivityIndicator color="#04211D" />
                  ) : (
                    <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>
                      Unirse
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => setAddModalOpen(false)}
              style={{ width: "100%", paddingVertical: 12, alignItems: "center", marginTop: 8 }}
            >
              <Text style={{ color: "#8DA8AC", fontWeight: "600", fontSize: 13 }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Invite panel (HU-2) */}
      <Modal
        visible={inviteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 16,
              padding: 20,
              backgroundColor: "#0A1620",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
            }}
          >
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 16, marginBottom: 14 }}>
              Invitar a {servers.find((s) => s.id === activeServer)?.name ?? "este servidor"}
            </Text>

            {inviteBusy ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator color="#37D6C0" />
                <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 10 }}>Generando invitación…</Text>
              </View>
            ) : inviteError ? (
              <View
                style={{
                  padding: 10,
                  borderRadius: 12,
                  marginBottom: 12,
                  backgroundColor: "rgba(255,127,114,0.15)",
                  borderWidth: 1,
                  borderColor: "#FF7F72",
                }}
              >
                <Text style={{ color: "#FF7F72", fontSize: 12 }}>{inviteError}</Text>
              </View>
            ) : invite ? (
              <>
                <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>
                  Link de invitación
                </Text>
                <View
                  style={{
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: "rgba(255,255,255,0.10)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.13)",
                    marginBottom: 12,
                  }}
                >
                  <Text selectable style={{ color: "#E6F3F3", fontSize: 13 }}>
                    {invite.url}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCopyInvite}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: "center",
                    backgroundColor: "#37D6C0",
                  }}
                >
                  <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>
                    {copied ? "¡Copiado!" : "Copiar"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity
              onPress={() => setInviteOpen(false)}
              style={{ width: "100%", paddingVertical: 12, alignItems: "center", marginTop: 8 }}
            >
              <Text style={{ color: "#8DA8AC", fontWeight: "600", fontSize: 13 }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave-server confirmation (HU-5) */}
      <Modal
        visible={leaveOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaveOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 16,
              padding: 20,
              backgroundColor: "#0A1620",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
            }}
          >
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 16, marginBottom: 10 }}>
              Abandonar servidor
            </Text>
            <Text style={{ color: "#8DA8AC", fontSize: 13, marginBottom: 16 }}>
              ¿Seguro que querés abandonar{" "}
              <Text style={{ color: "#E6F3F3", fontWeight: "700" }}>
                {servers.find((s) => s.id === activeServer)?.name ?? "este servidor"}
              </Text>
              ? Vas a perder el acceso a sus canales.
            </Text>

            {leaveError ? (
              <View
                style={{
                  padding: 10,
                  borderRadius: 12,
                  marginBottom: 12,
                  backgroundColor: "rgba(255,127,114,0.15)",
                  borderWidth: 1,
                  borderColor: "#FF7F72",
                }}
              >
                <Text style={{ color: "#FF7F72", fontSize: 12 }}>{leaveError}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setLeaveOpen(false)}
                disabled={leaveBusy}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.13)",
                  backgroundColor: "rgba(255,255,255,0.10)",
                }}
              >
                <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleLeaveServer}
                disabled={leaveBusy}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: "#FF7F72",
                  opacity: leaveBusy ? 0.7 : 1,
                }}
              >
                {leaveBusy ? (
                  <ActivityIndicator color="#04211D" />
                ) : (
                  <Text style={{ fontWeight: "700", fontSize: 14, color: "#04211D" }}>
                    Abandonar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}
