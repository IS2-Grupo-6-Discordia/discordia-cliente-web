export interface User {
  id: string
  name: string
  email: string
  avatar: string
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
  status: "online" | "away" | "offline"
}

export interface RoleGroup {
  name: string
  color: string
  members: Member[]
}

export interface Message {
  id: string
  author: string
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
