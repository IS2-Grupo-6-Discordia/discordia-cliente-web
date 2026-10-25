import { api } from "./client"
import type { VoiceJoinResponse, VoicePresenceParticipant } from "./types"
import type { RealtimeTicket } from "@/lib/realtime"

// HU-17: asks the voice service for access to a voice channel. The backend
// checks membership + CONNECT_VOICE (CA2, 403 with a Spanish `detail`) and
// removes the caller from any other room before answering (CA3), so a
// successful response means the old room is already gone server-side.
export async function joinVoiceChannel(channelId: string): Promise<VoiceJoinResponse> {
  return api<VoiceJoinResponse>(`/voice/channels/${channelId}/join`, { method: "POST" })
}

// HU-20 CA1: who is in a voice channel right now (user ids only). Any member of
// the server can see it, even without CONNECT_VOICE. Used as a fallback while
// the realtime socket is down.
export async function listVoiceParticipants(channelId: string): Promise<VoicePresenceParticipant[]> {
  const res = await api<{ participants: VoicePresenceParticipant[] }>(`/voice/channels/${channelId}/participants`)
  return res.participants
}

// HU-20 CA2: single-use ticket to open the voice realtime WebSocket, which
// doesn't go through the gateway (lib/realtime.ts).
export async function getVoiceRealtimeTicket(): Promise<RealtimeTicket> {
  return api<RealtimeTicket>("/voice/realtime/ticket", { method: "POST" })
}
