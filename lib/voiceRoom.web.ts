// Web implementation of the voice room (HU-17) on top of livekit-client.
// The backend hands out { url, token }; from there the browser talks WebRTC
// straight to LiveKit. Only this file knows about the SDK.
import { DisconnectReason, Room, RoomEvent, Track } from "livekit-client"
import type { RemoteTrack } from "livekit-client"
import { MicrophoneError, VoiceAbortedError } from "./voiceRoom.types"
import type { VoiceRoomEvents, VoiceRoomHandle, VoiceRoomParticipant } from "./voiceRoom.types"

export * from "./voiceRoom.types"

export const voiceSupported: boolean =
  typeof window !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices

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
  const room = new Room({
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })

  // Remote audio has to live in real <audio> elements to be heard. They stay
  // detached from layout in a hidden holder that dies with the room.
  const holder = document.createElement("div")
  holder.style.display = "none"
  document.body.appendChild(holder)

  // HU-18 CA1: on leave, stop hearing the others right away instead of relying
  // on the browser pausing detached <audio> elements.
  const releaseAudio = () => {
    holder.querySelectorAll("audio").forEach((el) => {
      el.pause()
      el.srcObject = null
    })
    holder.remove()
  }

  let closedByUs = false
  const emit = () => events.onParticipants(snapshot(room))

  room
    .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) holder.appendChild(track.attach())
    })
    .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach((el) => el.remove())
    })
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

  const { signal } = events
  if (signal?.aborted) {
    releaseAudio()
    throw new VoiceAbortedError()
  }
  // Leaving mid-connect: room.disconnect() makes the pending connect() or
  // mic publish reject, and the catches below turn that into an abort.
  const onAbort = () => {
    disconnect().catch(() => undefined)
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    try {
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

  // The join started from a click, so autoplay is normally allowed; this
  // covers browsers that still gate playback until an explicit resume.
  room.startAudio().catch(() => undefined)

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
