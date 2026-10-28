// Platform-neutral contract shared by voiceRoom.web.ts (LiveKit) and the
// native stub, so the rest of the app never imports livekit-client directly.

export interface VoiceRoomParticipant {
  // LiveKit identity; the voice service sets it to the user's id.
  identity: string
  isLocal: boolean
  micEnabled: boolean
  camEnabled: boolean
  videoTrack: VoiceVideoTrack | null
}

// Platform-owned LiveKit track reference. UI components cast it only in their
// platform-specific implementation.
export interface VoiceVideoTrack {
  readonly __voiceVideoTrack?: never
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
  // HU-18: aborting it while connecting tears the room down right away, so
  // "Desconectar" works before the call is fully up.
  signal?: AbortSignal
}

// Thrown by connectVoiceRoom when `signal` aborted the attempt.
export class VoiceAbortedError extends Error {
  constructor() {
    super("voice-aborted")
  }
}

export interface VoiceRoomHandle {
  disconnect: () => Promise<void>
  // HU-19: mutes/unmutes the published mic track; the others see it through
  // LiveKit's mute events. Rejects with MicrophoneError if unmuting fails.
  setMicEnabled: (enabled: boolean) => Promise<void>
  setCameraEnabled: (enabled: boolean) => Promise<void>
}

export class CameraError extends Error {
  kind: "denied" | "missing"

  constructor(kind: "denied" | "missing") {
    super(kind === "denied" ? "camera-denied" : "camera-missing")
    this.kind = kind
  }
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
