import { View, Text, Image } from "react-native"

interface AvatarProps {
  initials: string
  size?: number
  uri?: string | null
}

// Deterministic per-person palette: the same initials always map to the same
// color, so avatars read as distinct people instead of a wall of grey circles.
const PALETTE = ["#37D6C0", "#FF7F72", "#4FD69C", "#F0C24B", "#A093FF", "#5AB0F0"]

function colorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

// Opaque dark surface the placeholder tint is composited over. Keeping the
// fill opaque means the avatar never lets the background bleed through — which
// is what made it look split when it overlapped the profile banner.
const SURFACE = "#16242E"

// Blend a #RRGGBB over the opaque SURFACE at the given ratio, returning an
// opaque #RRGGBB. This preserves the per-person color identity while staying
// solid on any background.
function mix(hex: string, ratio: number): string {
  const br = parseInt(SURFACE.slice(1, 3), 16)
  const bg = parseInt(SURFACE.slice(3, 5), 16)
  const bb = parseInt(SURFACE.slice(5, 7), 16)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const ch = (fg: number, base: number) =>
    Math.round(fg * ratio + base * (1 - ratio))
      .toString(16)
      .padStart(2, "0")
  return `#${ch(r, br)}${ch(g, bg)}${ch(b, bb)}`
}

export default function Avatar({ initials, size = 28, uri }: AvatarProps) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 9999 }}
      />
    )
  }

  const color = colorFor(initials || "?")

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        backgroundColor: mix(color, 0.22),
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: mix(color, 0.45),
      }}
    >
      <Text
        style={{
          color,
          fontWeight: "700",
          fontSize: size * 0.36,
        }}
      >
        {initials}
      </Text>
    </View>
  )
}
