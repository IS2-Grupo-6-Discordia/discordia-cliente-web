import { api } from "./client"
import type { Server, Category, RoleGroup } from "./types"

const USE_MOCK = !process.env.EXPO_PUBLIC_API_URL

const MOCK_SERVERS: Server[] = [
  { id: "1", name: "FIUBA · IS2", abbr: "FI", color: "#37D6C0", mention: 2 },
  { id: "2", name: "IS2 Proyecto", abbr: "IS2", color: "#FF7F72", unread: true },
  { id: "3", name: "TP Final", abbr: "TP", color: "#4FD69C" },
  { id: "4", name: "Algoritmos", abbr: "AM", color: "#F0C24B", unread: true },
]

const MOCK_CATEGORIES: Category[] = [
  {
    id: "general",
    name: "General",
    channels: [
      { id: "anuncios", name: "anuncios", type: "text" },
      { id: "general", name: "general", type: "text" },
      { id: "checkpoint-2", name: "checkpoint-2", type: "text", unread: true, mention: 3 },
      { id: "recursos", name: "recursos", type: "text", unread: true },
    ],
  },
  {
    id: "voz",
    name: "Voz",
    channels: [
      { id: "sala-1", name: "Sala 1", type: "voice" },
      { id: "sala-2", name: "Sala 2", type: "voice" },
    ],
  },
]

const MOCK_ROLES: RoleGroup[] = [
  {
    name: "Owner",
    color: "#37D6C0",
    members: [{ id: "1", name: "Mora B.", avatar: "MB", color: "#37D6C0", status: "online" }],
  },
  {
    name: "Moderación",
    color: "#F0C24B",
    members: [
      { id: "2", name: "Juanpi", avatar: "JP", color: "#F0C24B", status: "online" },
      { id: "3", name: "Lucía R.", avatar: "LR", color: "#A093FF", status: "away" },
    ],
  },
  {
    name: "Miembros",
    color: "#8DA8AC",
    members: [
      { id: "4", name: "Facundo", avatar: "FA", color: "#37D6C0", status: "online" },
      { id: "5", name: "Tomás S.", avatar: "TS", color: "#4FD69C", status: "online" },
      { id: "6", name: "Nadia V.", avatar: "NV", color: "#FF7F72", status: "offline" },
    ],
  },
]

export async function getServers(): Promise<Server[]> {
  if (USE_MOCK) return MOCK_SERVERS
  return api<Server[]>("/servers")
}

export async function getCategories(serverId: string): Promise<Category[]> {
  if (USE_MOCK) return MOCK_CATEGORIES
  return api<Category[]>(`/servers/${serverId}/categories`)
}

export async function getRoles(serverId: string): Promise<RoleGroup[]> {
  if (USE_MOCK) return MOCK_ROLES
  return api<RoleGroup[]>(`/servers/${serverId}/roles`)
}
