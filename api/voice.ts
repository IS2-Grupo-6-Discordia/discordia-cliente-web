import { api } from "./client"
import type { VoiceJoinResponse } from "./types"

// HU-17: asks the voice service for access to a voice channel. The backend
// checks membership + CONNECT_VOICE (CA2, 403 with a Spanish `detail`) and
// removes the caller from any other room before answering (CA3), so a
// successful response means the old room is already gone server-side.
export async function joinVoiceChannel(channelId: string): Promise<VoiceJoinResponse> {
  return api<VoiceJoinResponse>(`/voice/channels/${channelId}/join`, { method: "POST" })
}
