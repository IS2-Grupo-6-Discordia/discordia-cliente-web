type ChimePlayer = { seekTo: (seconds: number) => unknown; play: () => void }

let player: ChimePlayer | null | undefined

export function playJoinSound() {
  try {
    if (player === undefined) {
      const { createAudioPlayer } = require("expo-audio") as typeof import("expo-audio")
      const chime = createAudioPlayer(require("@/assets/sounds/join.wav"))
      chime.volume = 0.6
      player = chime
    }
    if (!player) return
    player.seekTo(0)
    player.play()
  } catch {
    player = null
  }
}
