import { useEffect, useRef, useState } from "react"
import { View, Text, Pressable, ScrollView, Platform } from "react-native"
import type { LayoutChangeEvent } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import Avatar from "@/components/Avatar"
import VoiceVideoTile from "@/components/VoiceVideoTile"
import type { VoiceParticipant } from "@/context/VoiceContext"

export type VoiceLayout = "auto" | "mosaic" | "spotlight" | "sidebar"

type LayoutIcon = "sparkles-outline" | "grid-outline" | "square-outline" | "browsers-outline"

export const VOICE_LAYOUTS: { value: VoiceLayout; label: string; icon: LayoutIcon }[] = [
  { value: "auto", label: "Automático", icon: "sparkles-outline" },
  { value: "mosaic", label: "Mosaico", icon: "grid-outline" },
  { value: "spotlight", label: "Destacado", icon: "square-outline" },
  { value: "sidebar", label: "Barra lateral", icon: "browsers-outline" },
]

const GAP = 8
const RATIO = 16 / 9
const CONTROLS_HIDE_DELAY_MS = 350

function fitInCell(cellW: number, cellH: number) {
  const w = Math.max(0, Math.min(cellW, cellH * RATIO))
  return { w, h: w / RATIO }
}

function fitGrid(count: number, width: number, height: number) {
  let best = { cols: 1, w: 0, h: 0 }
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols)
    const { w, h } = fitInCell((width - GAP * (cols - 1)) / cols, (height - GAP * (rows - 1)) / rows)
    if (w > best.w) best = { cols, w, h }
  }
  return best
}

function pickMain(participants: VoiceParticipant[], pinnedId: string | null) {
  return (
    participants.find((p) => p.id === pinnedId) ??
    participants.find((p) => !p.isLocal && p.speaking) ??
    participants.find((p) => !p.isLocal && p.camEnabled && p.videoTrack) ??
    participants.find((p) => !p.isLocal) ??
    participants[0]
  )
}

function Tile({
  participant,
  width,
  height,
  pinned,
  compact,
  onTogglePin,
}: {
  participant: VoiceParticipant
  width: number
  height: number
  pinned: boolean
  compact: boolean
  onTogglePin: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [touched, setTouched] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  const hoverIn = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setHovered(true)
  }
  const hoverOut = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setHovered(false), CONTROLS_HIDE_DELAY_MS)
  }

  const showControls = hovered || touched
  const hasVideo = !!(participant.camEnabled && participant.videoTrack)
  const avatarSize = Math.round(Math.max(28, Math.min(112, height * 0.38)))
  const speaking = !!participant.speaking && participant.micEnabled
  const radius = compact ? 10 : 14

  return (
    <View style={{ width, height }}>
      <Pressable
        onPress={() => setTouched((v) => !v)}
        onHoverIn={hoverIn}
        onHoverOut={hoverOut}
        accessibilityLabel={`${participant.name}${participant.isLocal ? " (vos)" : ""}`}
        style={{
          width,
          height,
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: "#16262F",
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "web" ? ({ cursor: "default" } as object) : {}),
        }}
      >
        {hasVideo ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <VoiceVideoTile track={participant.videoTrack!} mirrored={participant.isLocal} />
          </View>
        ) : (
          <View style={{ borderRadius: 9999, padding: 3, borderWidth: 3, borderColor: speaking ? "#37D6C0" : "transparent" }}>
            <Avatar initials={participant.avatar} uri={participant.avatarUrl} size={avatarSize} />
          </View>
        )}

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: radius,
            borderWidth: speaking || pinned ? 3 : 1,
            borderColor: speaking ? "#37D6C0" : pinned ? "rgba(55,214,192,0.55)" : "rgba(255,255,255,0.06)",
          }}
        />

        {!participant.micEnabled ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: compact ? 20 : 26,
              height: compact ? 20 : 26,
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(10,22,32,0.72)",
            }}
          >
            <Ionicons name="mic-off" size={compact ? 11 : 14} color="#FF7F72" />
          </View>
        ) : null}

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 8,
            bottom: 8,
            maxWidth: width - 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: "rgba(10,22,32,0.55)",
          }}
        >
          {pinned ? <Ionicons name="pin" size={10} color="#37D6C0" /> : null}
          <Text numberOfLines={1} style={{ color: "#F2F7F7", fontSize: compact ? 10.5 : 12, fontWeight: "600", flexShrink: 1 }}>
            {participant.isLocal ? `${participant.name} (vos)` : participant.name}
          </Text>
        </View>
      </Pressable>

      {showControls ? (
        <Pressable
          onPress={() => {
            setTouched(false)
            onTogglePin()
          }}
          onHoverIn={hoverIn}
          onHoverOut={hoverOut}
          accessibilityLabel={pinned ? `Dejar de fijar a ${participant.name}` : `Fijar a ${participant.name}`}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: compact ? 8 : 11,
            paddingVertical: compact ? 6 : 7,
            borderRadius: 9999,
            backgroundColor: pinned ? "#37D6C0" : "rgba(10,22,32,0.82)",
          }}
        >
          <Ionicons name={pinned ? "pin" : "pin-outline"} size={14} color={pinned ? "#04211D" : "#E6F3F3"} />
          {compact ? null : (
            <Text style={{ color: pinned ? "#04211D" : "#E6F3F3", fontSize: 11.5, fontWeight: "700" }}>
              {pinned ? "Dejar de fijar" : "Fijar"}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  )
}

function OverflowTile({ hidden, width, height }: { hidden: VoiceParticipant[]; width: number; height: number }) {
  const shown = hidden.slice(0, 3)
  const avatarSize = Math.round(Math.max(24, Math.min(52, height * 0.26)))
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 14,
        backgroundColor: "#16262F",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {shown.map((p, i) => (
          <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -avatarSize * 0.3, borderRadius: 9999, borderWidth: 2, borderColor: "#16262F" }}>
            <Avatar initials={p.avatar} uri={p.avatarUrl} size={avatarSize} />
          </View>
        ))}
      </View>
      <Text style={{ color: "#E6F3F3", fontSize: 12, fontWeight: "700" }}>
        {hidden.length === 1 ? "1 persona más" : `${hidden.length} personas más`}
      </Text>
    </View>
  )
}

export default function VoiceStage({
  participants,
  layout,
  pinnedId,
  onTogglePin,
}: {
  participants: VoiceParticipant[]
  layout: VoiceLayout
  pinnedId: string | null
  onTogglePin: (id: string) => void
}) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })

  const { width: W, height: H } = size
  const narrow = W > 0 && W < 600
  const pinned = participants.some((p) => p.id === pinnedId) ? pinnedId : null
  const main = pickMain(participants, pinned)
  const effective: VoiceLayout =
    participants.length <= 1 ? "mosaic" : layout === "auto" ? (pinned ? "sidebar" : "mosaic") : layout

  const tile = (p: VoiceParticipant, width: number, height: number, compact = false) => (
    <Tile
      key={p.id}
      participant={p}
      width={width}
      height={height}
      compact={compact}
      pinned={p.id === pinned}
      onTogglePin={() => onTogglePin(p.id)}
    />
  )

  let content = null

  if (W > 0 && H > 0 && main) {
    if (effective === "spotlight") {
      const fit = fitInCell(W, H)
      content = tile(main, fit.w, fit.h)
    } else if (effective === "sidebar") {
      const others = participants.filter((p) => p.id !== main.id)
      const sideStrip = W >= 600 && W >= H * 1.15
      if (sideStrip) {
        const stripW = Math.min(260, Math.max(160, W * 0.22))
        const thumbH = stripW / RATIO
        const fit = fitInCell(W - stripW - GAP, H)
        content = (
          <View style={{ flexDirection: "row", gap: GAP, width: W, height: H }}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{tile(main, fit.w, fit.h)}</View>
            <ScrollView
              style={{ width: stripW, flexGrow: 0 }}
              contentContainerStyle={{ gap: GAP, justifyContent: "center", flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {others.map((p) => tile(p, stripW, thumbH, true))}
            </ScrollView>
          </View>
        )
      } else {
        const stripH = Math.min(110, Math.max(72, H * 0.18))
        const thumbW = stripH * RATIO
        const fit = fitInCell(W, H - stripH - GAP)
        content = (
          <View style={{ gap: GAP, width: W, height: H }}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{tile(main, fit.w, fit.h)}</View>
            <ScrollView
              horizontal
              style={{ height: stripH, flexGrow: 0 }}
              contentContainerStyle={{ gap: GAP, justifyContent: "center", flexGrow: 1 }}
              showsHorizontalScrollIndicator={false}
            >
              {others.map((p) => tile(p, thumbW, stripH, true))}
            </ScrollView>
          </View>
        )
      }
    } else {
      const ordered = pinned ? [main, ...participants.filter((p) => p.id !== main.id)] : participants
      const maxTiles = narrow ? 8 : 12
      const overflow = ordered.length > maxTiles
      const visible = overflow ? ordered.slice(0, maxTiles - 1) : ordered
      const hidden = overflow ? ordered.slice(maxTiles - 1) : []
      const fit = fitGrid(visible.length + (overflow ? 1 : 0), W, H)
      const cells: (VoiceParticipant | "overflow")[] = [...visible, ...(overflow ? (["overflow"] as const) : [])]
      const rows: (VoiceParticipant | "overflow")[][] = []
      for (let i = 0; i < cells.length; i += fit.cols) rows.push(cells.slice(i, i + fit.cols))
      const compact = fit.w < 260
      content = (
        <View style={{ gap: GAP, alignItems: "center", justifyContent: "center" }}>
          {rows.map((row, i) => (
            <View key={i} style={{ flexDirection: "row", gap: GAP, justifyContent: "center" }}>
              {row.map((cell) =>
                cell === "overflow" ? (
                  <OverflowTile key="overflow" hidden={hidden} width={fit.w} height={fit.h} />
                ) : (
                  tile(cell, fit.w, fit.h, compact)
                ),
              )}
            </View>
          ))}
        </View>
      )
    }
  }

  return (
    <View style={{ flex: 1, padding: narrow ? 8 : 14 }}>
      <View onLayout={onLayout} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {content}
      </View>
    </View>
  )
}
