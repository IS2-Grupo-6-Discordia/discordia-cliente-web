import { useEffect, useState } from "react"
import type { VoiceAudioTrack } from "@/lib/voiceRoom"

const SILENT = [0, 0, 0]
const EDGES_HZ = [120, 500, 1400, 4000]
const FRAME_MS = 40

let context: AudioContext | null = null

export function useAudioBands(track: VoiceAudioTrack | null | undefined): number[] {
  const [bands, setBands] = useState(SILENT)

  useEffect(() => {
    const mediaTrack = (track as unknown as { mediaStreamTrack?: MediaStreamTrack } | null | undefined)?.mediaStreamTrack
    if (!mediaTrack || typeof AudioContext === "undefined") {
      setBands(SILENT)
      return
    }
    context = context ?? new AudioContext()
    if (context.state === "suspended") context.resume().catch(() => undefined)
    const source = context.createMediaStreamSource(new MediaStream([mediaTrack]))
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.3
    analyser.minDecibels = -70
    analyser.maxDecibels = -25
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const binHz = context.sampleRate / analyser.fftSize
    const edges = EDGES_HZ.map((hz) => Math.max(1, Math.min(data.length, Math.round(hz / binHz))))

    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < FRAME_MS) return
      last = now
      analyser.getByteFrequencyData(data)
      setBands(
        [0, 1, 2].map((band) => {
          let sum = 0
          for (let i = edges[band]; i < edges[band + 1]; i++) sum += data[i]
          return Math.min(1, (sum / Math.max(1, edges[band + 1] - edges[band]) / 255) * 1.3)
        }),
      )
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      analyser.disconnect()
    }
  }, [track])

  return bands
}
