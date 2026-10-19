// Native fallback for the voice room (HU-17). Real-time audio on iOS/Android
// needs @livekit/react-native plus a development build, which the app does not
// ship yet; Metro picks voiceRoom.web.ts on web, so only native lands here.
import type { VoiceRoomEvents, VoiceRoomHandle } from "./voiceRoom.types"

export * from "./voiceRoom.types"

export const voiceSupported: boolean = false

export async function connectVoiceRoom(
  _url: string,
  _token: string,
  _events: VoiceRoomEvents,
): Promise<VoiceRoomHandle> {
  throw new Error("voice-unsupported")
}
