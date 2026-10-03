import { api } from "./client"
import type { AdminServer } from "./types"

const USE_MOCK = !process.env.EXPO_PUBLIC_API_URL

function mockDelay(ms = 600) {
  return new Promise((r) => setTimeout(r, ms))
}

const MOCK_ADMIN_SERVERS: AdminServer[] = [
  {
    id: "srv-1",
    name: "FIUBA · IS2",
    iconUrl: null,
    ownerId: "user-1",
    memberCount: 6,
    createdAt: "2025-08-15T10:00:00Z",
  },
  {
    id: "srv-2",
    name: "Gaming Night",
    iconUrl: null,
    ownerId: "user-2",
    memberCount: 23,
    createdAt: "2025-09-01T14:30:00Z",
  },
  {
    id: "srv-3",
    name: "Proyecto Final",
    iconUrl: null,
    ownerId: "user-1",
    memberCount: 4,
    createdAt: "2025-10-20T08:00:00Z",
  },
]

interface BackendAdminServer {
  id: string
  name: string
  icon_url: string | null
  owner_id: string
  member_count: number
  created_at: string
}

function toAdminServer(b: BackendAdminServer): AdminServer {
  return {
    id: b.id,
    name: b.name,
    iconUrl: b.icon_url,
    ownerId: b.owner_id,
    memberCount: b.member_count,
    createdAt: b.created_at,
  }
}

export async function getAdminServers(search?: string): Promise<AdminServer[]> {
  if (USE_MOCK) {
    await mockDelay()
    if (!search) return MOCK_ADMIN_SERVERS
    const q = search.toLowerCase()
    return MOCK_ADMIN_SERVERS.filter((s) => s.name.toLowerCase().includes(q))
  }

  const query = search ? `?search=${encodeURIComponent(search)}` : ""
  const res = await api<BackendAdminServer[]>(`/admin/servers${query}`)
  return res.map(toAdminServer)
}
