export type PresenceStatus = "online" | "away" | "dnd" | "offline"

export type UserStatus = "online" | "away" | "dnd" | "invisible"

export interface User {
  id: string
  name: string
  email: string
  avatar: string
  avatarUrl?: string | null
  bio?: string | null
  status?: UserStatus
  createdAt?: string
}

// Another user's PUBLIC profile. Explicitly carries no private data (no email,
// no createdAt): the backend endpoint that feeds this type only returns fields
// that are safe to show to anyone.
export interface PublicUser {
  id: string
  name: string
  bio?: string | null
  avatarUrl?: string | null
  status: PresenceStatus
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Server {
  id: string
  name: string
  abbr: string
  color: string
  unread?: boolean
  mention?: number
  iconUrl?: string | null
  bannerUrl?: string | null
  ownerId?: string
}

// A real role from the servers backend (GET /servers/{id}/roles), distinct from
// `RoleGroup` (the demo roster grouping). `permissions` is the backend's own
// free-form permission list; the admin permission is the string `administrator`.
// `isDefault` is resolved client-side against the server's default role so the
// UI can block its deletion (HU-5 / #92), which the backend rejects with 409.
export interface ServerRole {
  id: string
  serverId: string
  name: string
  permissions: string[]
  position: number
  isDefault?: boolean
}

// A real server member, from the servers backend (user id + role) hydrated with
// the public name/avatar from the auth service. Distinct from `Member`, which is
// the mock roster shape used by the demo UI.
export interface ServerMember {
  userId: string
  role: "owner" | "member"
  name: string
  avatar: string
  avatarUrl: string | null
  status: PresenceStatus
  joinedAt: string
}

// HU-7: a per-channel permission overwrite for a role. `allow`/`deny` carry the
// backend's own permission tokens; a permission listed in neither is inherited
// (the role's normal server-level permission applies). `roleId` maps the
// backend's snake_case `role_id`.
export interface ChannelOverwrite {
  roleId: string
  allow: string[]
  deny: string[]
}

// HU-25/26: an active ban. Names come from the auth service, like members.
export interface ServerBan {
  userId: string
  name: string
  avatar: string
  avatarUrl: string | null
  bannedBy: string
  bannedByName: string
  reason: string | null
  createdAt: string
}

// What the current user may do in a server. `permissions` are the backend's
// lowercase names ("ban_members", ...). Only used to hide actions that would
// fail: the backend checks every action again.
export interface MyServerPermissions {
  isOwner: boolean
  permissions: string[]
}

export function hasServerPermission(perms: MyServerPermissions | null, name: string): boolean {
  if (!perms) return false
  return perms.isOwner || perms.permissions.includes("administrator") || perms.permissions.includes(name)
}

export type TransferStatus = "pending" | "accepted" | "rejected" | "cancelled"

// HU-7: an ownership transfer between the current owner (from) and a member (to).
export interface OwnershipTransfer {
  id: string
  serverId: string
  fromUserId: string
  toUserId: string
  status: TransferStatus
  createdAt: string
  resolvedAt: string | null
}

export interface Invite {
  id: string
  code: string
  url: string
  serverId: string
  expiresAt?: string | null
  maxUses?: number | null
  uses: number
  createdAt: string
}

export interface Channel {
  id: string
  name: string
  type: "text" | "voice"
  topic?: string | null
  unread?: boolean
  mention?: number
}

export interface Category {
  id: string
  name: string
  channels: Channel[]
}

export interface Member {
  id: string
  name: string
  avatar: string
  color: string
  status: PresenceStatus
}

export interface RoleGroup {
  name: string
  color: string
  members: Member[]
}

export interface Message {
  id: string
  author: string
  // Public id of the author, when known. Used to open their public profile.
  // Mock messages don't carry it, so their authors aren't tappable yet.
  authorId?: string
  color: string
  time: string
  text: string
  edited?: boolean
  system?: boolean
  role?: string
  roleColor?: string
  mentionUser?: string
  mentionRole?: string
  reactions?: { emoji: string; count: number; mine?: boolean }[]
}


// HU-17: what POST /voice/channels/{id}/join hands back. `url` is the LiveKit
// server (wss://...) and `token` a short-lived JWT scoped to that one room.
export interface VoiceJoinResponse {
  url: string
  token: string
}

// HU-20: one entry of GET /voice/channels/{id}/participants and of the
// realtime `voice.participants` snapshot. Names come from /auth/users/batch.
export interface VoicePresenceParticipant {
  user_id: string
  microphone_muted: boolean
  joined_at: string
}

export interface UnreadCounts {
  unread: number
  mentions: number
  serverId?: string
}

export interface UnreadSummary {
  channels: Record<string, UnreadCounts>
  servers: Record<string, UnreadCounts>
}
