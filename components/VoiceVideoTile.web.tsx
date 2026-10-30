import { useEffect, useRef } from "react"
import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client"
import type { VoiceVideoTrack } from "@/lib/voiceRoom"

export default function VoiceVideoTile({
  track,
  mirrored,
  fit = "cover",
}: {
  track: VoiceVideoTrack
  mirrored: boolean
  fit?: "cover" | "contain"
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const element = ref.current
    const videoTrack = track as LocalVideoTrack | RemoteVideoTrack
    if (!element) return
    videoTrack.attach(element)
    return () => {
      videoTrack.detach(element)
      element.srcObject = null
    }
  }, [track])

  return (
    <video
      ref={ref}
      muted
      playsInline
      autoPlay
      style={{ width: "100%", height: "100%", objectFit: fit, transform: mirrored ? "scaleX(-1)" : undefined }}
    />
  )
}
