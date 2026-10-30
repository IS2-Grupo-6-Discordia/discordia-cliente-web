import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { Platform } from "react-native"
import { joinVoiceChannel } from "@/api/voice"
import { getUsersBatch, initials } from "@/api/auth"
import { friendlyError } from "@/api/client"
import { useAuth } from "@/context/AuthContext"
import { playJoinSound } from "@/lib/joinSound"
import { CameraError, connectVoiceRoom, MicrophoneError, VoiceAbortedError, voiceSupported } from "@/lib/voiceRoom"
import type { VoiceRoomHandle, VoiceRoomParticipant, VoiceDropReason, VoiceVideoTrack } from "@/lib/voiceRoom"

// HU-17: one voice connection per session, shared by the channel list (chat)
// and the Voz tab. It lives in the (main) layout so switching tabs never drops
// the call, and unmounting it (logout) always hangs up.

export interface VoiceChannelRef {
  id: string
  name: string
  serverId: string
  serverName: string
}

export interface VoiceParticipant {
  id: string
  name: string
  avatar: string
  avatarUrl?: string | null
  isLocal: boolean
  micEnabled: boolean
  camEnabled?: boolean
  speaking?: boolean
  videoTrack?: VoiceVideoTrack | null
}

export type VoiceStatus = "idle" | "connecting" | "connected"

interface VoiceState {
  supported: boolean
  status: VoiceStatus
  channel: VoiceChannelRef | null
  participants: VoiceParticipant[]
  // Set when the room dropped on its own (not through leave()).
  dropNotice: string
  clearDropNotice: () => void
  // Resolves once connected (or silently if leave() cancelled it); rejects
  // with a user-facing Spanish message.
  join: (channel: VoiceChannelRef) => Promise<void>
  // HU-18: hangs up, also mid-connect. LiveKit tells the others we left.
  leave: () => Promise<void>
  // HU-19: whether our own mic is transmitting. Every join starts unmuted
  // (HU-17 CA1), also when switching channels.
  micEnabled: boolean
  // Rejects with a user-facing Spanish message if the mic can't be re-enabled.
  toggleMic: () => Promise<void>
  camEnabled: boolean
  cameraError: string
  toggleCamera: () => Promise<void>
}

const DROP_MESSAGES: Record<VoiceDropReason, string> = {
  removed: "Te desconectaron del canal de voz. Puede que te hayas unido a otro canal desde otra pestaña.",
  lost: "Se perdió la conexión con el canal de voz.",
}

function joinErrorMessage(err: unknown): string {
  if (err instanceof MicrophoneError) {
    return err.kind === "denied"
      ? "Necesitamos acceso a tu micrófono para unirte. Habilitalo en el navegador y probá de nuevo."
      : "No encontramos ningún micrófono. Conectá uno y probá de nuevo."
  }
  return friendlyError(err)
}

function micErrorMessage(err: unknown): string {
  if (err instanceof MicrophoneError) {
    return err.kind === "denied"
      ? "No tenemos acceso a tu micrófono. Habilitalo en el navegador para volver a hablar."
      : "No encontramos ningún micrófono. Conectá uno para volver a hablar."
  }
  return "No pudimos cambiar el estado de tu micrófono. Probá de nuevo."
}

function cameraErrorMessage(err: unknown): string {
  if (err instanceof CameraError) {
    return err.kind === "denied"
      ? "No tenemos acceso a tu cámara. Habilitala en la configuración y probá de nuevo."
      : "No encontramos ninguna cámara. Conectá una y probá de nuevo."
  }
  return "No pudimos cambiar el estado de tu cámara. Puede que el canal no tenga video habilitado."
}

const VoiceContext = createContext<VoiceState | null>(null)

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [status, setStatus] = useState<VoiceStatus>("idle")
  const [channel, setChannel] = useState<VoiceChannelRef | null>(null)
  const [roomParticipants, setRoomParticipants] = useState<VoiceRoomParticipant[]>([])
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatarUrl?: string | null }>>({})
  const [dropNotice, setDropNotice] = useState("")
  const [cameraError, setCameraError] = useState("")

  const handleRef = useRef<VoiceRoomHandle | null>(null)
  // Bumped on every join/leave so a slow, superseded attempt can't overwrite
  // the state of the one that replaced it.
  const attemptRef = useRef(0)
  const busyRef = useRef(false)
  // Aborts the LiveKit connect of the attempt in flight, if any.
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    handleRef.current = null
    setStatus("idle")
    setChannel(null)
    setRoomParticipants([])
    setCameraError("")
  }, [])

  const join = useCallback(
    async (target: VoiceChannelRef) => {
      if (!voiceSupported) {
        throw new Error("La voz por ahora solo está disponible en la versión web.")
      }
      if (busyRef.current) return
      busyRef.current = true
      const attempt = ++attemptRef.current
      setDropNotice("")

      try {
        // Ask for access first: on 403/404/503 the current call (if any) stays
        // untouched, so a failed switch never leaves the user with nothing.
        let access
        try {
          access = await joinVoiceChannel(target.id)
        } catch (err) {
          throw new Error(joinErrorMessage(err))
        }
        // leave() was pressed while we waited for access.
        if (attemptRef.current !== attempt) return

        // CA3: the backend already removed us from the previous room; tear the
        // local side down too before opening the new one.
        const previous = handleRef.current
        handleRef.current = null
        if (previous) await previous.disconnect()

        setStatus("connecting")
        setChannel(target)
        setRoomParticipants([])

        const abort = new AbortController()
        abortRef.current = abort
        try {
          const handle = await connectVoiceRoom(access.url, access.token, {
            signal: abort.signal,
            onParticipants: (list) => {
              if (attemptRef.current === attempt) setRoomParticipants(list)
            },
            onDropped: (reason) => {
              if (attemptRef.current !== attempt) return
              reset()
              setDropNotice(DROP_MESSAGES[reason])
            },
          })
          if (attemptRef.current !== attempt) {
            await handle.disconnect()
            return
          }
          handleRef.current = handle
          setStatus("connected")
        } catch (err) {
          // Cancelled by leave() or replaced by a newer join: nothing to report.
          if (err instanceof VoiceAbortedError || attemptRef.current !== attempt) return
          reset()
          throw new Error(joinErrorMessage(err))
        } finally {
          if (abortRef.current === abort) abortRef.current = null
        }
      } finally {
        // leave() already released the lock for the next join.
        if (attemptRef.current === attempt) busyRef.current = false
      }
    },
    [reset],
  )

  const leave = useCallback(async () => {
    attemptRef.current++
    busyRef.current = false
    abortRef.current?.abort()
    abortRef.current = null
    const handle = handleRef.current
    reset()
    if (handle) await handle.disconnect()
  }, [reset])

  // Hang up when the provider goes away (logout) or the tab closes: an open
  // LiveKit session keeps billing minutes and keeps us listed in the room.
  useEffect(() => {
    const hangUp = () => {
      abortRef.current?.abort()
      handleRef.current?.disconnect().catch(() => undefined)
      handleRef.current = null
    }
    if (Platform.OS === "web") window.addEventListener("pagehide", hangUp)
    return () => {
      if (Platform.OS === "web") window.removeEventListener("pagehide", hangUp)
      hangUp()
    }
  }, [])

  // LiveKit only knows identities (= user ids); resolve names/avatars for the
  // ones we haven't seen yet.
  useEffect(() => {
    const missing = roomParticipants
      .filter((p) => !p.isLocal && !profiles[p.identity])
      .map((p) => p.identity)
    if (missing.length === 0) return
    getUsersBatch(missing)
      .then((users) => {
        setProfiles((prev) => {
          const next = { ...prev }
          users.forEach((u) => {
            next[u.id] = { name: u.name, avatarUrl: u.avatarUrl }
          })
          return next
        })
      })
      .catch(() => undefined)
  }, [roomParticipants, profiles])

  const knownRemotesRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (status !== "connected") {
      knownRemotesRef.current = null
      return
    }
    const remotes = roomParticipants.filter((p) => !p.isLocal).map((p) => p.identity)
    const known = knownRemotesRef.current
    knownRemotesRef.current = new Set(remotes)
    if (known && remotes.some((id) => !known.has(id))) playJoinSound()
  }, [status, roomParticipants])

  const participants: VoiceParticipant[] = roomParticipants.map((p) => {
    const profile = p.isLocal && user ? { name: user.name, avatarUrl: user.avatarUrl } : profiles[p.identity]
    const name = profile?.name ?? "Miembro"
    return {
      id: p.identity,
      name,
      avatar: initials(name),
      avatarUrl: profile?.avatarUrl,
      isLocal: p.isLocal,
      micEnabled: p.micEnabled,
      camEnabled: p.camEnabled,
      speaking: p.speaking,
      videoTrack: p.videoTrack,
    }
  })

  const clearDropNotice = useCallback(() => setDropNotice(""), [])

  const micEnabled = roomParticipants.find((p) => p.isLocal)?.micEnabled ?? false
  // Two fast clicks would otherwise race two setMicrophoneEnabled calls.
  const micBusyRef = useRef(false)

  const toggleMic = useCallback(async () => {
    const handle = handleRef.current
    if (!handle || micBusyRef.current) return
    micBusyRef.current = true
    try {
      await handle.setMicEnabled(!micEnabled)
    } catch (err) {
      throw new Error(micErrorMessage(err))
    } finally {
      micBusyRef.current = false
    }
  }, [micEnabled])

  const camEnabled = roomParticipants.find((p) => p.isLocal)?.camEnabled ?? false
  const cameraBusyRef = useRef(false)

  const toggleCamera = useCallback(async () => {
    const handle = handleRef.current
    if (!handle || cameraBusyRef.current) return
    cameraBusyRef.current = true
    setCameraError("")
    try {
      await handle.setCameraEnabled(!camEnabled)
    } catch (err) {
      setCameraError(cameraErrorMessage(err))
    } finally {
      cameraBusyRef.current = false
    }
  }, [camEnabled])

  return (
    <VoiceContext.Provider
      value={{
        supported: voiceSupported,
        status,
        channel,
        participants,
        dropNotice,
        clearDropNotice,
        join,
        leave,
        micEnabled,
        toggleMic,
        camEnabled,
        cameraError,
        toggleCamera,
      }}
    >
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const ctx = useContext(VoiceContext)
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider")
  return ctx
}
