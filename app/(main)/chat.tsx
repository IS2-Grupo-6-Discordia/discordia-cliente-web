import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from "react-native"
import { getServers, getCategories, getRoles, getMessages, sendMessage } from "@/api"
import type { Server, Category, RoleGroup, Message } from "@/api/types"
import Avatar from "@/components/Avatar"
import StatusDot from "@/components/StatusDot"

export default function ChatScreen() {
  const [activeServer, setActiveServer] = useState("1")
  const [activeChannel, setActiveChannel] = useState("general")
  const [showMembers, setShowMembers] = useState(false)
  const [input, setInput] = useState("")

  const [servers, setServers] = useState<Server[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [roles, setRoles] = useState<RoleGroup[]>([])
  const [messages, setMessages] = useState<Message[]>([])

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
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 15,
              backgroundColor: "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
              opacity: 0.6,
            }}
          >
            <Text style={{ color: "#8DA8AC", fontSize: 18 }}>+</Text>
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
          <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
            {servers.find((s) => s.id === activeServer)?.name ?? ""}
          </Text>
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
    </View>
  )
}
