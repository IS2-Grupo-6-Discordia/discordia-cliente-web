import { VideoTrack } from "@livekit/react-native"
import type { ComponentProps } from "react"
import type { VoiceVideoTrack } from "@/lib/voiceRoom"

export default function VoiceVideoTile({ track, mirrored }: { track: VoiceVideoTrack; mirrored: boolean }) {
  return (
    <VideoTrack
      trackRef={track as unknown as ComponentProps<typeof VideoTrack>["trackRef"]}
      style={{ width: "100%", height: "100%", transform: mirrored ? [{ scaleX: -1 }] : undefined }}
    />
  )
}
