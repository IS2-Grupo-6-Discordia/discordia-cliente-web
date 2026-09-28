import { api, apiUpload } from "./client"
import type { Server, Category, RoleGroup, Invite } from "./types"

// Reads always stay mocked: the backend does NOT expose GET /servers,
// GET categories, or GET roles endpoints yet, so there is nothing to call.
const READ_USE_MOCK = true
// Writes hit the real backend whenever an API URL is configured.
const WRITE_USE_MOCK = !process.env.EXPO_PUBLIC_API_URL

// The single example server. Everything else the user sees in the rail is a
// server they created or joined.
export const MOCK_SERVER_ID = "1"

const MOCK_SERVERS: Server[] = [
  { id: MOCK_SERVER_ID, name: "FIUBA · IS2", abbr: "FI", color: "#37D6C0", mention: 2 },
]

// Channels + demo messages only belong to the example server.
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

// A fresh, empty starter layout for any server the user creates or joins.
// Channel ids are namespaced per server so their messages never collide with
// (or inherit from) the example server or another new server.
function starterCategories(serverId: string): Category[] {
  return [
    {
      id: `${serverId}:cat-general`,
      name: "General",
      channels: [{ id: `${serverId}:general`, name: "general", type: "text" }],
    },
    {
      id: `${serverId}:cat-voz`,
      name: "Voz",
      channels: [{ id: `${serverId}:sala-1`, name: "Sala 1", type: "voice" }],
    },
  ]
}

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

// NOTE: getServers/getCategories/getRoles have no backend endpoint yet, so they
// stay mocked forever (READ_USE_MOCK). Do not wire them to the API.
export async function getServers(): Promise<Server[]> {
  if (READ_USE_MOCK) return MOCK_SERVERS
  return api<Server[]>("/servers")
}

export async function getCategories(serverId: string): Promise<Category[]> {
  if (READ_USE_MOCK) {
    return serverId === MOCK_SERVER_ID ? MOCK_CATEGORIES : starterCategories(serverId)
  }
  return api<Category[]>(`/servers/${serverId}/categories`)
}

export async function getRoles(serverId: string): Promise<RoleGroup[]> {
  // Only the example server ships with demo members. Servers the user makes or
  // joins start without a roster so they don't look pre-populated.
  if (READ_USE_MOCK) {
    return serverId === MOCK_SERVER_ID ? MOCK_ROLES : []
  }
  return api<RoleGroup[]>(`/servers/${serverId}/roles`)
}

// ---- Writes (real backend, gated by WRITE_USE_MOCK) --------------------------

const PALETTE = ["#37D6C0", "#FF7F72", "#4FD69C", "#F0C24B", "#A093FF"]

function mockDelay(ms = 700) {
  return new Promise((r) => setTimeout(r, ms))
}

// Deterministic color pick from the palette based on a simple hash of the id.
function colorFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

// Initials: first letter of up to 2 words; for a single word, its first 2 chars.
function abbrFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

interface BackendChannel {
  id: string
  name: string
  type: "text" | "voice"
}

interface BackendServerOut {
  id: string
  name: string
  icon_url: string | null
  owner_id: string
  created_at: string
  channels: BackendChannel[]
}

interface BackendJoinedServerOut extends BackendServerOut {
  role: "owner" | "member"
  joined: boolean
}

interface BackendInviteOut {
  id: string
  code: string
  url: string
  server_id: string
  created_by: string
  expires_at: string | null
  max_uses: number | null
  uses: number
  revoked_at: string | null
  created_at: string
}

// Maps a backend ServerOut/JoinedServerOut into the rail-friendly Server shape.
function toServer(backend: BackendServerOut): Server {
  return {
    id: backend.id,
    name: backend.name,
    abbr: abbrFor(backend.name),
    color: colorFor(backend.id),
    iconUrl: backend.icon_url ?? null,
    ownerId: backend.owner_id,
  }
}

function toInvite(backend: BackendInviteOut): Invite {
  return {
    id: backend.id,
    code: backend.code,
    url: backend.url,
    serverId: backend.server_id,
    expiresAt: backend.expires_at,
    maxUses: backend.max_uses,
    uses: backend.uses,
    createdAt: backend.created_at,
  }
}

// HU-1: create a server. `icon` may be a web Blob or a native file descriptor.
export async function createServer(
  name: string,
  icon?: Blob | { uri: string; name: string; type: string } | null,
): Promise<Server> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    const id = "srv-" + Math.random().toString(36).slice(2, 10)
    return {
      id,
      name,
      abbr: abbrFor(name),
      color: colorFor(id),
      iconUrl: null,
    }
  }

  const fd = new FormData()
  fd.append("name", name)
  if (icon) {
    if (icon instanceof Blob) {
      fd.append("icon", icon, "icon")
    } else {
      fd.append("icon", icon as any)
    }
  }
  const res = await apiUpload<BackendServerOut>("/servers", fd)
  return toServer(res)
}

// HU-2: create an invite for a server. Returns a ready-to-copy invite URL.
export async function createInvite(
  serverId: string,
  opts?: { expiresInSeconds?: number | null; maxUses?: number | null },
): Promise<Invite> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    const code = Math.random().toString(36).slice(2, 10)
    return {
      id: "inv-" + Math.random().toString(36).slice(2, 10),
      code,
      url: `https://discordia.app/invite/${code}`,
      serverId,
      expiresAt: null,
      maxUses: opts?.maxUses ?? null,
      uses: 0,
      createdAt: new Date().toISOString(),
    }
  }

  const res = await api<BackendInviteOut>(`/servers/${serverId}/invites`, {
    method: "POST",
    body: JSON.stringify({
      expires_in_seconds: opts?.expiresInSeconds ?? null,
      max_uses: opts?.maxUses ?? null,
    }),
  })
  return toInvite(res)
}

// HU-3: join a server via an invite code. `joined` is false if already a member.
export async function joinServer(
  code: string,
): Promise<{ server: Server; joined: boolean }> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    const id = "srv-" + Math.random().toString(36).slice(2, 10)
    return {
      server: {
        id,
        name: "Servidor " + code.slice(0, 4).toUpperCase(),
        abbr: abbrFor(code),
        color: colorFor(id),
        iconUrl: null,
      },
      joined: true,
    }
  }

  const res = await api<BackendJoinedServerOut>(
    `/invites/${encodeURIComponent(code)}/join`,
    { method: "POST" },
  )
  return { server: toServer(res), joined: res.joined }
}

// HU-5: leave a server. Backend returns 204 No Content on success.
// Errors (403/404/409) arrive as ApiError whose `message` carries the backend detail.
export async function leaveServer(serverId: string): Promise<void> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return
  }

  await api<void>("/servers/" + serverId + "/members/me", { method: "DELETE" })
}

// Optional preview of an invite before joining (HU-3 optional).
export async function resolveInvite(code: string): Promise<Invite> {
  if (WRITE_USE_MOCK) {
    await mockDelay(400)
    return {
      id: "inv-preview",
      code,
      url: `https://discordia.app/invite/${code}`,
      serverId: "srv-preview",
      expiresAt: null,
      maxUses: null,
      uses: 0,
      createdAt: new Date().toISOString(),
    }
  }

  const res = await api<BackendInviteOut>(`/invites/${encodeURIComponent(code)}`)
  return toInvite(res)
}
