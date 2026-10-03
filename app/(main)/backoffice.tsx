import { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getAdminServers } from "@/api/admin"
import { friendlyError } from "@/api/client"
import type { AdminServer } from "@/api/types"

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function BackofficeScreen() {
  const [servers, setServers] = useState<AdminServer[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchServers = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAdminServers(query || undefined)
      setServers(data)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchServers("")
  }, [fetchServers])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchServers(search)
    }, 400)
    return () => clearTimeout(timer)
  }, [search, fetchServers])

  const renderItem = ({ item }: { item: AdminServer }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.07)",
      }}
    >
      {/* Icon / Abbr */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: "rgba(55,214,192,0.15)",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Text style={{ color: "#37D6C0", fontWeight: "800", fontSize: 14 }}>
          {item.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() ?? "")
            .join("")}
        </Text>
      </View>

      {/* Name + date */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 2 }}>
          Creado el {formatDate(item.createdAt)}
        </Text>
      </View>

      {/* Member count */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name="people-outline" size={14} color="#8DA8AC" />
        <Text style={{ color: "#8DA8AC", fontSize: 13, fontWeight: "600" }}>
          {item.memberCount}
        </Text>
      </View>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1620" }}>
      {/* Title */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }}>
          Servidores
        </Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, marginTop: 2 }}>
          Listado de todos los servidores de la plataforma
        </Text>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.06)",
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 40,
          }}
        >
          <Ionicons name="search-outline" size={16} color="#8DA8AC" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre..."
            placeholderTextColor="#5A7A80"
            style={{
              flex: 1,
              marginLeft: 8,
              color: "#E6F3F3",
              fontSize: 14,
              ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
            }}
          />
          {search.length > 0 && (
            <Ionicons
              name="close-circle"
              size={16}
              color="#8DA8AC"
              onPress={() => setSearch("")}
            />
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#37D6C0" size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="alert-circle-outline" size={32} color="#FF7F72" />
          <Text style={{ color: "#FF7F72", fontSize: 14, textAlign: "center", marginTop: 8 }}>
            {error}
          </Text>
        </View>
      ) : servers.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Ionicons name="server-outline" size={32} color="#8DA8AC" />
          <Text style={{ color: "#8DA8AC", fontSize: 14, textAlign: "center", marginTop: 8 }}>
            {search ? "No se encontraron servidores" : "No hay servidores aún"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={servers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  )
}
