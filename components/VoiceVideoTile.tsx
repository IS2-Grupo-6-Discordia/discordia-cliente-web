import { VideoTrack } from "@livekit/react-native"
import type { ComponentProps } from "react"
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
  return (
    <VideoTrack
      trackRef={track as unknown as ComponentProps<typeof VideoTrack>["trackRef"]}
      objectFit={fit}
      style={{ width: "100%", height: "100%", transform: mirrored ? [{ scaleX: -1 }] : undefined }}
    />
  )
}
