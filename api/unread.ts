import { api } from "./client"
import type { UnreadSummary } from "./types"

// El backend acepta hasta 50 servidores por consulta.
const MAX_SERVER_IDS = 50

interface BackendUnreadSummary {
  channels: { channel_id: string; server_id: string; unread_count: number; mention_count: number }[]
  servers: { server_id: string; unread_count: number; mention_count: number }[]
}

export const EMPTY_UNREAD: UnreadSummary = { channels: {}, servers: {} }

export async function getUnreadSummary(serverIds: string[]): Promise<UnreadSummary> {
  const summary: UnreadSummary = { channels: {}, servers: {} }
  for (let i = 0; i < serverIds.length; i += MAX_SERVER_IDS) {
    const chunk = serverIds.slice(i, i + MAX_SERVER_IDS)
    const res = await api<BackendUnreadSummary>(`/unread?server_ids=${chunk.join(",")}`)
    for (const c of res.channels) {
      summary.channels[c.channel_id] = {
        unread: c.unread_count,
        mentions: c.mention_count,
        serverId: c.server_id,
      }
    }
    for (const s of res.servers) {
      summary.servers[s.server_id] = { unread: s.unread_count, mentions: s.mention_count }
    }
  }
  return summary
}

export async function markChannelRead(channelId: string): Promise<void> {
  await api(`/channels/${channelId}/read`, { method: "POST" })
}

export function withoutChannel(summary: UnreadSummary, channelId: string): UnreadSummary {
  const removed = summary.channels[channelId]
  if (!removed) return summary
  const channels = { ...summary.channels }
  delete channels[channelId]
  const servers = { ...summary.servers }
  const serverId = removed.serverId
  const server = serverId ? servers[serverId] : undefined
  if (serverId && server) {
    const unread = server.unread - removed.unread
    const mentions = server.mentions - removed.mentions
    if (unread <= 0) delete servers[serverId]
    else servers[serverId] = { unread, mentions: Math.max(0, mentions) }
  }
  return { channels, servers }
}
