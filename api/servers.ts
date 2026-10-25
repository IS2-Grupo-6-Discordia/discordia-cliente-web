import { File as NativeFile } from "expo-file-system"
import { getUsersBatch } from "./auth"
import { api, apiUpload, ApiError } from "./client"
import type { Server, Category, RoleGroup, ServerRole, Invite, ServerMember, OwnershipTransfer, ChannelOverwrite } from "./types"

// The backend's admin permission string, surfaced in each RoleOut.permissions[].
// The UI reads it to decide whether to show admin-only actions (banner config,
// role management); it is the backend's own vocabulary, not invented here.
export const ADMIN_PERMISSION = "administrator"

// Reads always stay mocked: the backend does NOT expose GET /servers,
// GET categories, or GET roles endpoints yet, so there is nothing to call.
const READ_USE_MOCK = false
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

// getServers now reads REAL data: the backend exposes GET /servers (the user's own
// memberships), so servers created or joined persist across reloads. Only when no API
// URL is configured (pure offline/mock mode) does it fall back to the example server.
// getCategories/getRoles stay mocked because those endpoints still don't exist.
export async function getServers(): Promise<Server[]> {
  if (WRITE_USE_MOCK) return MOCK_SERVERS
  const res = await api<BackendServerSummary[]>("/servers")
  return res.map(toServer)
}

export async function getCategories(serverId: string): Promise<Category[]> {
  if (READ_USE_MOCK) {
    return serverId === MOCK_SERVER_ID ? MOCK_CATEGORIES : starterCategories(serverId)
  }

  const channels = await api<BackendChannel[]>(`/servers/${serverId}/channels`)
  // The backend has no concept of categories — group all channels into one.
  if (channels.length === 0) return []
  return [
    {
      id: `${serverId}:channels`,
      name: "Canales",
      channels: channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        topic: ch.topic,
      })),
    },
  ]
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
  topic?: string | null
}

// A server as returned by GET /servers (the sidebar list): no channels.
interface BackendServerSummary {
  id: string
  name: string
  icon_url: string | null
  banner_url: string | null
  owner_id: string
  created_at: string
}

// A server as returned by create/join: the summary plus its channels.
interface BackendServerOut extends BackendServerSummary {
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

// Builds the shareable invite URL from the CURRENT origin, so the link matches
// where the app is actually running: localhost in dev, the real domain in prod.
// The backend's own `url` is ignored because it hardcodes its deploy host.
function inviteUrl(code: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://discordia.app"
  return `${origin}/invite/${code}`
}

// Maps a backend ServerOut/JoinedServerOut into the rail-friendly Server shape.
function toServer(backend: BackendServerSummary): Server {
  return {
    id: backend.id,
    name: backend.name,
    abbr: abbrFor(backend.name),
    color: colorFor(backend.id),
    iconUrl: backend.icon_url ?? null,
    bannerUrl: backend.banner_url ?? null,
    ownerId: backend.owner_id,
  }
}

function toInvite(backend: BackendInviteOut): Invite {
  return {
    id: backend.id,
    code: backend.code,
    url: inviteUrl(backend.code),
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
      fd.append("icon", new NativeFile(icon.uri) as any)
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
      url: inviteUrl(code),
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

// HU-2 (CA4): list a server's active invites so the owner can review and revoke.
export async function listInvites(serverId: string): Promise<Invite[]> {
  if (WRITE_USE_MOCK) {
    await mockDelay(400)
    return []
  }

  const res = await api<BackendInviteOut[]>(`/servers/${serverId}/invites`)
  return res.map(toInvite)
}

// HU-2 (CA4): revoke an invite. Backend returns 204 No Content on success.
export async function revokeInvite(serverId: string, inviteId: string): Promise<void> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return
  }

  await api<void>(`/servers/${serverId}/invites/${inviteId}`, { method: "DELETE" })
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

export async function deleteServer(serverId: string, confirmationName: string): Promise<void> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return
  }

  await api<void>("/servers/" + serverId, {
    method: "DELETE",
    body: JSON.stringify({ confirmation_name: confirmationName }),
  })
}

// HU-4 (#95): edit a server's banner. Admin-only — the backend answers 403 when
// the caller lacks admin permissions (CA2), and 422 when the image's format or
// size is unsupported, saving nothing in that case (CA3). Sent as a multipart
// PATCH with a single `banner` file field, mirroring how createServer uploads
// the icon. Returns the updated server so the new banner shows for everyone once
// it persists (CA1). `banner` is a web Blob or a native file descriptor.
type ServerImageUpload = Blob | { uri: string; name: string; type: string }

// HU-4: edit the server's general settings (name, icon and/or banner) in a
// single PATCH. Only the fields that are passed get sent; the backend rejects
// an empty patch with 422, so the caller must send at least one.
export async function updateServer(
  serverId: string,
  fields: { name?: string; icon?: ServerImageUpload; banner?: ServerImageUpload },
): Promise<Server> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    const existing = MOCK_SERVERS.find((s) => s.id === serverId)
    const name = fields.name ?? existing?.name ?? "Servidor"
    const blobUrl = (img?: ServerImageUpload) =>
      img && typeof URL !== "undefined" && img instanceof Blob ? URL.createObjectURL(img) : null
    return {
      id: serverId,
      name,
      abbr: abbrFor(name),
      color: colorFor(serverId),
      iconUrl: blobUrl(fields.icon) ?? existing?.iconUrl ?? null,
      bannerUrl: blobUrl(fields.banner) ?? existing?.bannerUrl ?? null,
    }
  }

  const fd = new FormData()
  if (fields.name !== undefined) fd.append("name", fields.name)
  const appendImage = (field: string, img?: ServerImageUpload) => {
    if (!img) return
    if (img instanceof Blob) fd.append(field, img, field)
    else fd.append(field, new NativeFile(img.uri) as any)
  }
  appendImage("icon", fields.icon)
  appendImage("banner", fields.banner)
  const res = await apiUpload<BackendServerSummary>("/servers/" + serverId, fd, "PATCH")
  return toServer(res)
}

// Optional preview of an invite before joining (HU-3 optional).
export async function resolveInvite(code: string): Promise<Invite> {
  if (WRITE_USE_MOCK) {
    await mockDelay(400)
    return {
      id: "inv-preview",
      code,
      url: inviteUrl(code),
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

interface BackendServerMember {
  user_id: string
  role: "owner" | "member"
  joined_at: string
}

// Lists a server's members (HU-7 support: lets the owner pick who to transfer
// ownership to). The servers backend only stores ids + roles, so names and
// avatars are hydrated from the auth service in a single batch call and merged.
// A member whose public profile can't be resolved still appears, with a neutral
// fallback name, so the roster is never silently short.
export async function getCommonServers(userId: string): Promise<Server[]> {
  if (WRITE_USE_MOCK) {
    await mockDelay(400)
    return []
  }

  const res = await api<BackendServerSummary[]>(`/servers/common/${userId}`)
  return res.map(toServer)
}

export async function getServerMembers(serverId: string): Promise<ServerMember[]> {
  if (WRITE_USE_MOCK) {
    await mockDelay(500)
    return []
  }

  const rows = await api<BackendServerMember[]>(`/servers/${serverId}/members`)
  const profiles = await getUsersBatch(rows.map((row) => row.user_id))
  const byId = new Map(profiles.map((profile) => [profile.id, profile]))

  return rows.map((row) => {
    const profile = byId.get(row.user_id)
    const name = profile?.name ?? "Usuario"
    return {
      userId: row.user_id,
      role: row.role,
      name,
      avatar: abbrFor(name),
      avatarUrl: profile?.avatarUrl ?? null,
      status: profile?.status ?? "offline",
      joinedAt: row.joined_at,
    }
  })
}

// ---- Channels: delete + update -----------------------------------------------

// Delete a channel. Backend returns 204 No Content on success.
export async function deleteChannel(serverId: string, channelId: string): Promise<void> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return
  }
  await api<void>(`/servers/${serverId}/channels/${channelId}`, { method: "DELETE" })
}

// Update a channel's name and/or topic. Returns the updated channel.
export async function updateChannel(
  serverId: string,
  channelId: string,
  data: { name?: string; topic?: string | null },
): Promise<BackendChannel> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return { id: channelId, name: data.name ?? "canal", type: "text", topic: data.topic ?? null }
  }
  return api<BackendChannel>(`/servers/${serverId}/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

// Create a channel inside a server. Returns the new channel.
export async function createChannel(
  serverId: string,
  data: { name: string; type: "text" | "voice" },
): Promise<BackendChannel> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    const id = "ch-" + Math.random().toString(36).slice(2, 10)
    return { id, name: data.name, type: data.type, topic: null }
  }
  return api<BackendChannel>(`/servers/${serverId}/channels`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// ---- HU-7: per-channel role permission overrides ----------------------------

// A channel overwrite as returned by the backend (snake_case `role_id`).
interface BackendChannelOverwrite {
  role_id: string
  allow: string[]
  deny: string[]
}

function toChannelOverwrite(backend: BackendChannelOverwrite): ChannelOverwrite {
  return { roleId: backend.role_id, allow: backend.allow, deny: backend.deny }
}

// HU-7: list every role's permission overwrite for a channel. A role with no
// overwrite simply isn't in the list (its permissions are fully inherited).
// `channelId` is the real backend channel id (the same one updateChannel uses).
export async function getChannelOverwrites(
  serverId: string,
  channelId: string,
): Promise<ChannelOverwrite[]> {
  if (WRITE_USE_MOCK) {
    await mockDelay(400)
    return []
  }
  const res = await api<BackendChannelOverwrite[]>(
    `/servers/${serverId}/channels/${channelId}/overwrites`,
  )
  return res.map(toChannelOverwrite)
}

// HU-7: create or replace a role's overwrite for a channel. The backend replaces
// the whole allow/deny pair, so the COMPLETE desired lists are always sent. When
// BOTH lists are empty the backend deletes the overwrite (the role goes back to
// fully inheriting). Admin-only — the backend answers 403 when the caller lacks
// permission (or grants/denies a permission they don't hold), 404 when the
// channel or role no longer exists, and 422 when a permission isn't valid for a
// channel. The response body (the stored overwrite) isn't read back: the caller
// already holds the computed allow/deny it just sent.
export async function setChannelOverwrite(
  serverId: string,
  channelId: string,
  roleId: string,
  allow: string[],
  deny: string[],
): Promise<void> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return
  }
  await api<void>(`/servers/${serverId}/channels/${channelId}/overwrites/${roleId}`, {
    method: "PUT",
    body: JSON.stringify({ allow, deny }),
  })
}

// HU-7: remove a role's overwrite for a channel (DELETE → 204, idempotent). The
// role goes back to fully inheriting its server-level permissions. Same admin/403
// rules as setChannelOverwrite.
export async function deleteChannelOverwrite(
  serverId: string,
  channelId: string,
  roleId: string,
): Promise<void> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return
  }
  await api<void>(`/servers/${serverId}/channels/${channelId}/overwrites/${roleId}`, {
    method: "DELETE",
  })
}

// ---- Channels: reorder ------------------------------------------------------

// Reorder all channels in a server. `channelIds` is the full list in the desired order.
export async function reorderChannels(
  serverId: string,
  channelIds: string[],
): Promise<BackendChannel[]> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return channelIds.map((id, i) => ({ id, name: `ch-${i}`, type: "text" as const, topic: null }))
  }
  return api<BackendChannel[]>(`/servers/${serverId}/channels/reorder`, {
    method: "PUT",
    body: JSON.stringify({ channel_ids: channelIds }),
  })
}

// ---- HU-7: ownership transfer -----------------------------------------------

interface BackendOwnershipTransfer {
  id: string
  server_id: string
  from_user_id: string
  to_user_id: string
  status: "pending" | "accepted" | "rejected" | "cancelled"
  created_at: string
  resolved_at: string | null
}

function toOwnershipTransfer(backend: BackendOwnershipTransfer): OwnershipTransfer {
  return {
    id: backend.id,
    serverId: backend.server_id,
    fromUserId: backend.from_user_id,
    toUserId: backend.to_user_id,
    status: backend.status,
    createdAt: backend.created_at,
    resolvedAt: backend.resolved_at,
  }
}

// Synthetic transfer used in mock mode so the flow is exercisable offline.
function mockTransfer(
  serverId: string,
  toUserId: string,
  status: OwnershipTransfer["status"],
): OwnershipTransfer {
  return {
    id: "tr-" + Math.random().toString(36).slice(2, 10),
    serverId,
    fromUserId: "mock-owner",
    toUserId,
    status,
    createdAt: new Date().toISOString(),
    resolvedAt: status === "pending" ? null : new Date().toISOString(),
  }
}

// Owner starts a transfer of the server's ownership to another member.
export async function startOwnershipTransfer(
  serverId: string,
  toUserId: string,
): Promise<OwnershipTransfer> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return mockTransfer(serverId, toUserId, "pending")
  }

  const res = await api<BackendOwnershipTransfer>(
    `/servers/${serverId}/ownership-transfer`,
    { method: "POST", body: JSON.stringify({ to_user_id: toUserId }) },
  )
  return toOwnershipTransfer(res)
}

// Returns the pending transfer relevant to the caller (as sender or recipient),
// or null when there is none. The backend answers 404 for "no pending transfer",
// which is a normal empty state here, not an error to surface.
export async function getPendingTransfer(
  serverId: string,
): Promise<OwnershipTransfer | null> {
  if (WRITE_USE_MOCK) {
    await mockDelay(400)
    return null
  }

  try {
    const res = await api<BackendOwnershipTransfer>(
      `/servers/${serverId}/ownership-transfer`,
    )
    return toOwnershipTransfer(res)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

// Recipient accepts the pending transfer: they become the new owner.
export async function acceptOwnershipTransfer(
  serverId: string,
): Promise<OwnershipTransfer> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return mockTransfer(serverId, "mock-recipient", "accepted")
  }

  const res = await api<BackendOwnershipTransfer>(
    `/servers/${serverId}/ownership-transfer/accept`,
    { method: "POST" },
  )
  return toOwnershipTransfer(res)
}

// Recipient rejects the pending transfer: ownership stays with the sender.
export async function rejectOwnershipTransfer(
  serverId: string,
): Promise<OwnershipTransfer> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return mockTransfer(serverId, "mock-recipient", "rejected")
  }

  const res = await api<BackendOwnershipTransfer>(
    `/servers/${serverId}/ownership-transfer/reject`,
    { method: "POST" },
  )
  return toOwnershipTransfer(res)
}

// ---- HU-5 (#92): roles -------------------------------------------------------

// A real role as returned by the roles endpoints (RoleOut).
interface BackendRole {
  id: string
  server_id: string
  name: string
  permissions: string[]
  position: number
  created_at: string
}

function toServerRole(backend: BackendRole): ServerRole {
  return {
    id: backend.id,
    serverId: backend.server_id,
    name: backend.name,
    permissions: backend.permissions,
    position: backend.position,
  }
}

// The server's real role list (GET /servers/{id}/roles). Distinct from getRoles,
// which returns the member roster grouped for the sidebar; this feeds the role
// manager. Ordered by the backend's `position`.
export async function getServerRoles(serverId: string): Promise<ServerRole[]> {
  if (WRITE_USE_MOCK) {
    await mockDelay(400)
    return []
  }
  const res = await api<BackendRole[]>(`/servers/${serverId}/roles`)
  return res.map(toServerRole)
}

// The id of the server's default role (the one assigned to new members), or null
// when none is set. The UI uses it to block deletion of that role, which the
// backend rejects with 409 (a default role can't be deleted).
export async function getDefaultRoleId(serverId: string): Promise<string | null> {
  if (WRITE_USE_MOCK) {
    await mockDelay(300)
    return null
  }
  const res = await api<{ server_id: string; role: BackendRole | null }>(
    `/servers/${serverId}/default-role`,
  )
  return res.role?.id ?? null
}

// HU-4 (#95): set the server's default role (the one new members auto-receive).
// Admin-only — the backend answers 403 when the caller lacks
// MANAGE_ROLES/ADMINISTRATOR, or tries to set a role whose permissions they
// don't hold themselves. Sent as PUT with a single `role_id` field, and the
// response mirrors GET /default-role (`{ server_id, role }`), so the new default
// role id is read back the same way getDefaultRoleId reads it.
export async function setDefaultRole(serverId: string, roleId: string): Promise<string | null> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return roleId
  }
  const res = await api<{ server_id: string; role: BackendRole | null }>(
    `/servers/${serverId}/default-role`,
    {
      method: "PUT",
      body: JSON.stringify({ role_id: roleId }),
    },
  )
  return res.role?.id ?? roleId
}

// HU-5 (#92): permanently delete a role. Admin-only — the backend answers 403
// when the caller lacks admin permissions (CA2), and 409 when the role is the
// server's default role or an `administrator` role the caller holds. On success
// (204) the members that had the role lose its permissions (CA1).
export async function deleteRole(serverId: string, roleId: string): Promise<void> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return
  }
  await api<void>(`/servers/${serverId}/roles/${roleId}`, { method: "DELETE" })
}

// HU-1: create a role in a server. Admin-only — the backend assigns the default
// permissions and position, so the frontend only sends the name. The backend
// answers 403 when the caller lacks MANAGE_ROLES/ADMINISTRATOR (CA2), 409 when a
// role with that name already exists, and 422 when the name is empty or longer
// than 100 chars. On success (201) it returns the created role (same RoleOut
// shape as the roles listed by getServerRoles).
export async function createRole(serverId: string, name: string): Promise<ServerRole> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    const id = "role-" + Math.random().toString(36).slice(2, 10)
    return { id, serverId, name, permissions: [], position: 0 }
  }
  const res = await api<BackendRole>(`/servers/${serverId}/roles`, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
  return toServerRole(res)
}

// HU-2: edit a role's permissions. Admin-only. The backend REPLACES the whole
// permission mask, so the COMPLETE desired list is always sent (an empty array
// clears every permission). It answers 403 when the caller lacks
// MANAGE_ROLES/ADMINISTRATOR or tries to grant/remove a permission they don't
// hold themselves (CA3), 409 when removing `administrator` from the caller's own
// role (CA2; the owner is exempt), and 422 when a permission name is invalid. On
// success (200) it returns the updated role (same RoleOut shape as getServerRoles).
export async function updateRolePermissions(
  serverId: string,
  roleId: string,
  permissions: string[],
): Promise<ServerRole> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return { id: roleId, serverId, name: "Rol", permissions, position: 0 }
  }
  const res = await api<BackendRole>(`/servers/${serverId}/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify({ permissions }),
  })
  return toServerRole(res)
}

// HU-6: reorder the server's role hierarchy. `roleIds` is the COMPLETE list of
// the server's roles, each exactly once, in the desired order (first = position
// 1 = top). Admin-only — the backend answers 403 when the caller lacks
// MANAGE_ROLES/ADMINISTRATOR or the new order would place a role at/above the
// caller's own level (hierarchy violation; the owner is exempt), 404 when the
// server doesn't exist, and 422 when the list is empty, has duplicates, carries
// ids from another server, or is incomplete. On success (200) it returns the
// already-reordered role list (position 1..N), mapped like getServerRoles so the
// modal can replace its list in place without a reload.
export async function reorderRoles(serverId: string, roleIds: string[]): Promise<ServerRole[]> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return roleIds.map((id, i) => ({ id, serverId, name: `Rol ${i + 1}`, permissions: [], position: i + 1 }))
  }
  const res = await api<BackendRole[]>(`/servers/${serverId}/roles/reorder`, {
    method: "PUT",
    body: JSON.stringify({ role_ids: roleIds }),
  })
  return res.map(toServerRole)
}

// ---- HU-3: assign/remove a role to/from a member ----------------------------

// A member's roles (GET /servers/{id}/members/{userId}/roles → MemberRolesOut,
// the same shape getMemberPermissions reads). Mapped through toServerRole so the
// role selector can pre-check the ones the member already has. Ordered by the
// backend's `position`, like getServerRoles.
export async function getMemberRoles(serverId: string, userId: string): Promise<ServerRole[]> {
  if (WRITE_USE_MOCK) {
    await mockDelay(300)
    return []
  }
  const res = await api<{ user_id: string; roles: BackendRole[] }>(
    `/servers/${serverId}/members/${userId}/roles`,
  )
  return res.roles.map(toServerRole)
}

// HU-3: assign a role to a member (PUT, no body, idempotent). Admin-only — the
// backend answers 403 when the caller lacks MANAGE_ROLES/ADMINISTRATOR or tries
// to assign a role whose permissions they don't hold themselves. The response
// carries no meaningful body, so nothing is mapped. Member permissions are the
// backend-computed union of their roles; the frontend computes nothing.
export async function assignRoleToMember(
  serverId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return
  }
  await api<void>(`/servers/${serverId}/members/${userId}/roles/${roleId}`, { method: "PUT" })
}

// HU-3: remove a role from a member (DELETE → 204, idempotent). Same admin/403
// rules as assignRoleToMember. On success (204) the client returns undefined.
export async function removeRoleFromMember(
  serverId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  if (WRITE_USE_MOCK) {
    await mockDelay()
    return
  }
  await api<void>(`/servers/${serverId}/members/${userId}/roles/${roleId}`, { method: "DELETE" })
}

// The permission strings the current user holds in a server, flattened across
// all their roles (GET /servers/{id}/members/{id}/roles → MemberRolesOut). Lets
// the UI surface admin-only actions without inventing any permission logic: it
// reads the backend's own `permissions` arrays. Returns [] on any failure, so a
// caller that can't confirm admin simply falls back to owner-only gating.
export async function getMemberPermissions(
  serverId: string,
  userId: string,
): Promise<string[]> {
  if (WRITE_USE_MOCK) {
    await mockDelay(300)
    return []
  }
  try {
    const res = await api<{ user_id: string; roles: BackendRole[] }>(
      `/servers/${serverId}/members/${userId}/roles`,
    )
    const permissions = new Set<string>()
    for (const role of res.roles) {
      for (const permission of role.permissions) permissions.add(permission)
    }
    return Array.from(permissions)
  } catch {
    return []
  }
}
