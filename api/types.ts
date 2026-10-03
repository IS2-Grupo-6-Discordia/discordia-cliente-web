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
  ownerId?: string
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

export interface AuditEntry {
  id: string
  action: string
  actor: string
  target: string
  time: string
  reason: string
}

export interface AdminUser {
  name: string
  email: string
  av: string
  status: string
  tag: "ok" | "sus" | "warn"
  servers: number
  reports: number
  date: string
}

export interface KPI {
  label: string
  value: string
  delta: string
  warn: boolean
  spark: number[]
}
