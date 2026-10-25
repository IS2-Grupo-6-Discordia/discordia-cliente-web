import { useEffect, useMemo, useRef, useState } from "react"
import { getUsersBatch, initials } from "@/api/auth"
import { getVoiceRealtimeTicket, listVoiceParticipants } from "@/api/voice"
import type { VoicePresenceParticipant } from "@/api/types"
import { RealtimeConnection } from "@/lib/realtime"
import type { RealtimeMessage, RealtimeStatus } from "@/lib/realtime"

// HU-20: who sits in each voice channel of the server being viewed, kept up to
// date without reloading (CA2). It subscribes to those channels on the voice
// realtime socket; while the socket is down it falls back to polling the HTTP
// endpoint so the list never goes stale for long.

export interface PresenceParticipant {
  id: string
  name: string
  avatar: string
  avatarUrl?: string | null
  micEnabled: boolean
}

const POLL_INTERVAL_MS = 10000

export function useVoicePresence(channelIds: string[], enabled: boolean): Record<string, PresenceParticipant[]> {
  const [byChannel, setByChannel] = useState<Record<string, VoicePresenceParticipant[]>>({})
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatarUrl?: string | null }>>({})
  const [status, setStatus] = useState<RealtimeStatus>("closed")
  const connRef = useRef<RealtimeConnection | null>(null)
  const requestedRef = useRef(new Set<string>())

  // Stable key so a new array with the same ids doesn't resubscribe.
  const key = [...channelIds].sort().join(",")
  const ids = useMemo(() => (key ? key.split(",") : []), [key])

  // One socket per screen while enabled (logged in, real backend).
  useEffect(() => {
    if (!enabled) return
    const conn = new RealtimeConnection({
      getTicket: getVoiceRealtimeTicket,
      onStatus: setStatus,
      onMessage: (msg: RealtimeMessage) => {
        if (msg.type !== "voice.participants") {
          if (msg.type === "error") console.warn("[voice presence]", msg)
          return
        }
        const channelId = msg.channel_id as string
        const participants = (msg.participants as VoicePresenceParticipant[]) ?? []
        setByChannel((prev) => ({ ...prev, [channelId]: participants }))
      },
    })
    connRef.current = conn
    conn.start()
    return () => {
      conn.stop()
      connRef.current = null
      setByChannel({})
      setStatus("closed")
    }
  }, [enabled])

  // Follow the channel list: subscribe to new voice channels and drop the ones
  // that went away (diffed, so unchanged channels keep their roster on screen).
  const subscribedRef = useRef<string[]>([])
  useEffect(() => {
    const conn = connRef.current
    if (!enabled || !conn) {
      subscribedRef.current = []
      return
    }
    const removed = subscribedRef.current.filter((id) => !ids.includes(id))
    conn.subscribe(ids)
    conn.unsubscribe(removed)
    subscribedRef.current = ids
    if (removed.length > 0) {
      setByChannel((prev) => {
        const next = { ...prev }
        removed.forEach((id) => delete next[id])
        return next
      })
    }
  }, [enabled, ids])

  // Fallback: while the socket isn't open, poll every channel over HTTP.
  useEffect(() => {
    if (!enabled || status === "open" || ids.length === 0) return
    let cancelled = false
    const poll = () => {
      ids.forEach((id) => {
        listVoiceParticipants(id)
          .then((participants) => {
            if (!cancelled) setByChannel((prev) => ({ ...prev, [id]: participants }))
          })
          .catch(() => undefined)
      })
    }
    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enabled, status, ids])

  // The voice service only knows user ids: resolve names/avatars once each.
  useEffect(() => {
    const missing = new Set<string>()
    Object.values(byChannel).forEach((list) =>
      list.forEach((p) => {
        if (!profiles[p.user_id] && !requestedRef.current.has(p.user_id)) missing.add(p.user_id)
      }),
    )
    if (missing.size === 0) return
    const batch = [...missing]
    batch.forEach((id) => requestedRef.current.add(id))
    getUsersBatch(batch)
      .then((users) => {
        setProfiles((prev) => {
          const next = { ...prev }
          users.forEach((u) => {
            next[u.id] = { name: u.name, avatarUrl: u.avatarUrl }
          })
          return next
        })
      })
      // Let a later snapshot retry the ones that failed.
      .catch(() => batch.forEach((id) => requestedRef.current.delete(id)))
  }, [byChannel, profiles])

  return useMemo(() => {
    const out: Record<string, PresenceParticipant[]> = {}
    ids.forEach((id) => {
      out[id] = (byChannel[id] ?? []).map((p) => {
        const profile = profiles[p.user_id]
        const name = profile?.name ?? "Miembro"
        return {
          id: p.user_id,
          name,
          avatar: initials(name),
          avatarUrl: profile?.avatarUrl,
          micEnabled: !p.microphone_muted,
        }
      })
    })
    return out
  }, [ids, byChannel, profiles])
}
