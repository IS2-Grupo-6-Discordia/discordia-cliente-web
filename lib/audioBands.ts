import { useMultibandTrackVolume } from "@livekit/react-native"
import type { VoiceAudioTrack } from "@/lib/voiceRoom"

type MultibandTrack = Parameters<typeof useMultibandTrackVolume>[0]

export function useAudioBands(track: VoiceAudioTrack | null | undefined): number[] {
  const bands = useMultibandTrackVolume((track ?? undefined) as unknown as MultibandTrack, {
    bands: 3,
    minFrequency: 120,
    maxFrequency: 4000,
    updateInterval: 40,
  })
  return bands.length === 3 ? bands.map((v) => Math.min(1, v * 1.4)) : [0, 0, 0]
}

