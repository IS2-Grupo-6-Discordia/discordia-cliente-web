// Platform-neutral contract shared by voiceRoom.web.ts (LiveKit) and the
// native stub, so the rest of the app never imports livekit-client directly.

export interface VoiceRoomParticipant {
  // LiveKit identity; the voice service sets it to the user's id.
  identity: string
  isLocal: boolean
  micEnabled: boolean
}

// Why the room dropped without the user asking for it.
export type VoiceDropReason =
  // Removed server-side: joined another channel from a different tab/device (CA3),
  // or the account was suspended.
  | "removed"
  // Network loss or the media server went away.
  | "lost"

export interface VoiceRoomEvents {
  onParticipants: (participants: VoiceRoomParticipant[]) => void
  onDropped: (reason: VoiceDropReason) => void
}

export interface VoiceRoomHandle {
  disconnect: () => Promise<void>
}

// Thrown when the browser denies or lacks a microphone: without it CA1
// ("su audio empieza a transmitirse") cannot hold, so the join is aborted.
export class MicrophoneError extends Error {
  kind: "denied" | "missing"

  constructor(kind: "denied" | "missing") {
    super(kind === "denied" ? "microphone-denied" : "microphone-missing")
    this.kind = kind
  }
}
