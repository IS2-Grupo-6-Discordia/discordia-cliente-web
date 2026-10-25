// Native implementation of the voice room (HU-17) for the Android/iOS builds.
// Same contract as voiceRoom.web.ts; Metro picks this file off the web. It
// needs a development or release build: Expo Go does not ship the WebRTC
// native module that @livekit/react-native-webrtc provides.
import { PermissionsAndroid, Platform } from "react-native"
import { AudioSession, registerGlobals } from "@livekit/react-native"
import { DisconnectReason, Room, RoomEvent } from "livekit-client"
import { MicrophoneError, VoiceAbortedError } from "./voiceRoom.types"
import type { VoiceRoomEvents, VoiceRoomHandle, VoiceRoomParticipant } from "./voiceRoom.types"

export * from "./voiceRoom.types"

// livekit-client looks for the browser WebRTC globals; this installs the
// native ones before any Room is created.
registerGlobals()

export const voiceSupported: boolean = true

function snapshot(room: Room): VoiceRoomParticipant[] {
  const local = room.localParticipant
  const list: VoiceRoomParticipant[] = [
    { identity: local.identity, isLocal: true, micEnabled: local.isMicrophoneEnabled },
  ]
  room.remoteParticipants.forEach((p) => {
    list.push({ identity: p.identity, isLocal: false, micEnabled: p.isMicrophoneEnabled })
  })
  return list
}

// Asked up front so a denial surfaces as MicrophoneError("denied") instead of
// an opaque WebRTC error. iOS asks on first capture (NSMicrophoneUsageDescription).
async function ensureMicPermission(): Promise<void> {
  if (Platform.OS !== "android") return
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
  if (result !== PermissionsAndroid.RESULTS.GRANTED) throw new MicrophoneError("denied")
}

function toMicrophoneError(err: unknown): MicrophoneError | null {
  const name = err instanceof Error ? err.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return new MicrophoneError("denied")
  if (name === "NotFoundError" || name === "OverconstrainedError") return new MicrophoneError("missing")
  return null
}

export async function connectVoiceRoom(
  url: string,
  token: string,
  events: VoiceRoomEvents,
): Promise<VoiceRoomHandle> {
  const { signal } = events
  if (signal?.aborted) throw new VoiceAbortedError()

  await ensureMicPermission()

  const room = new Room({
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })

  // Remote audio plays on its own natively (no <audio> elements); the audio
  // session routes it to the speaker/headset and has to be released on leave.
  let sessionStarted = false
  const releaseAudio = () => {
    if (!sessionStarted) return
    sessionStarted = false
    AudioSession.stopAudioSession().catch(() => undefined)
  }

  let closedByUs = false
  const emit = () => events.onParticipants(snapshot(room))

  room
    .on(RoomEvent.ParticipantConnected, emit)
    .on(RoomEvent.ParticipantDisconnected, emit)
    .on(RoomEvent.TrackPublished, emit)
    .on(RoomEvent.TrackUnpublished, emit)
    .on(RoomEvent.TrackMuted, emit)
    .on(RoomEvent.TrackUnmuted, emit)
    .on(RoomEvent.LocalTrackPublished, emit)
    .on(RoomEvent.LocalTrackUnpublished, emit)
    .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      releaseAudio()
      if (closedByUs || reason === DisconnectReason.CLIENT_INITIATED) return
      const removed =
        reason === DisconnectReason.PARTICIPANT_REMOVED ||
        reason === DisconnectReason.DUPLICATE_IDENTITY ||
        reason === DisconnectReason.ROOM_DELETED
      events.onDropped(removed ? "removed" : "lost")
    })

  const disconnect = async () => {
    closedByUs = true
    // Also stops the local mic track, so we stop transmitting (CA1).
    await room.disconnect()
    releaseAudio()
  }

  // Leaving mid-connect: room.disconnect() makes the pending connect() or
  // mic publish reject, and the catches below turn that into an abort.
  const onAbort = () => {
    disconnect().catch(() => undefined)
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    try {
      await AudioSession.startAudioSession()
      sessionStarted = true
      await room.connect(url, token)
    } catch (err) {
      await disconnect()
      throw signal?.aborted ? new VoiceAbortedError() : err
    }

    try {
      // CA1: publishing the mic is what makes "su audio empieza a transmitirse".
      await room.localParticipant.setMicrophoneEnabled(true)
    } catch (err) {
      await disconnect()
      throw signal?.aborted ? new VoiceAbortedError() : (toMicrophoneError(err) ?? err)
    }
  } finally {
    signal?.removeEventListener("abort", onAbort)
  }

  if (signal?.aborted) {
    await disconnect()
    throw new VoiceAbortedError()
  }

  // HU-19: muting keeps the track published but stops sending audio (CA1), so
  // unmuting resumes it right away (CA2).
  const setMicEnabled = async (enabled: boolean) => {
    try {
      await room.localParticipant.setMicrophoneEnabled(enabled)
    } catch (err) {
      throw toMicrophoneError(err) ?? err
    } finally {
      emit()
    }
  }

  emit()
  return { disconnect, setMicEnabled }
}
