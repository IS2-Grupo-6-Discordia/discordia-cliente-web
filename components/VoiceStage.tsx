import { useEffect, useRef, useState } from "react"
import { View, Text, Pressable, Platform, Animated, Easing } from "react-native"
import type { LayoutChangeEvent } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import Avatar from "@/components/Avatar"
import VoiceVideoTile from "@/components/VoiceVideoTile"
import type { VoiceParticipant } from "@/context/VoiceContext"
import { useAudioBands } from "@/lib/audioBands"
import type { VoiceAudioTrack } from "@/lib/voiceRoom"

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
const MOVE_MS = 380
const FADE_MS = 260
const MOVE_EASING = Easing.bezier(0.2, 0, 0, 1)

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
    participants.find((p) => p.isScreen && !p.isLocal) ??
    participants.find((p) => p.isScreen) ??
    participants.find((p) => !p.isLocal && p.speaking) ??
    participants.find((p) => !p.isLocal && p.camEnabled && p.videoTrack) ??
    participants.find((p) => !p.isLocal) ??
    participants[0]
  )
}

const nativeDriver = Platform.OS !== "web"

function SpeakingIndicator({ compact }: { compact: boolean }) {
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current

  useEffect(() => {
    const loops = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 1, duration: 240 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
          Animated.timing(bar, { toValue: 0.35, duration: 240 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
        ]),
      ),
    )
    loops.forEach((loop) => loop.start())
    return () => loops.forEach((loop) => loop.stop())
  }, [bars])

  const size = compact ? 20 : 26
  const barHeight = compact ? 10 : 13
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        backgroundColor: "#37D6C0",
      }}
    >
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{ width: 3, height: barHeight, borderRadius: 2, backgroundColor: "#04211D", transform: [{ scaleY: bar }] }}
        />
      ))}
    </View>
  )
}

function SpeakingHalo({ size, track }: { size: number; track: VoiceAudioTrack | null | undefined }) {
  const bands = useAudioBands(track)
  const raw = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0)) / 3
  const peak = useRef(0.05)
  peak.current = Math.max(raw, peak.current * 0.985, 0.05)
  const level = Math.max(0, Math.min(1, (raw / peak.current - 0.3) / 0.7))
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const step = Animated.timing(pulse, { toValue: level, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver })
    step.start()
    return () => step.stop()
  }, [level, pulse])

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: 9999,
        backgroundColor: "#37D6C0",
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.6] }) }],
      }}
    />
  )
}

function Tile({
  participant,
  width,
  height,
  pinned,
  compact,
  onTogglePin,
  onToggleLocalMute,
}: {
  participant: VoiceParticipant
  width: number
  height: number
  pinned: boolean
  compact: boolean
  onTogglePin: () => void
  onToggleLocalMute: () => void
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

  const speakingGlow = useRef(new Animated.Value(0)).current
  const showControls = hovered || touched
  const hasVideo = !!(participant.camEnabled && participant.videoTrack)
  const avatarSize = Math.round(Math.max(28, Math.min(112, height * 0.38)))
  const speaking = !!participant.speaking && participant.micEnabled
  const radius = compact ? 10 : 14
  const badgeSize = compact ? 20 : 26

  useEffect(() => {
    const fade = Animated.timing(speakingGlow, {
      toValue: speaking ? 1 : 0,
      duration: speaking ? 120 : 320,
      easing: Easing.out(Easing.quad),
      useNativeDriver: nativeDriver,
    })
    fade.start()
    return () => fade.stop()
  }, [speaking, speakingGlow])

  return (
    <View style={{ width: "100%", height: "100%" }}>
      <Pressable
        onPress={() => setTouched((v) => !v)}
        onHoverIn={hoverIn}
        onHoverOut={hoverOut}
        accessibilityLabel={`${participant.name}${participant.isLocal ? " (vos)" : ""}`}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: participant.isScreen ? "#05090D" : "#16262F",
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "web" ? ({ cursor: "default" } as object) : {}),
        }}
      >
        {hasVideo ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <VoiceVideoTile
              track={participant.videoTrack!}
              mirrored={participant.isLocal && !participant.isScreen}
              fit={participant.isScreen ? "contain" : "cover"}
            />
          </View>
        ) : (
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            {speaking ? <SpeakingHalo size={avatarSize} track={participant.audioTrack} /> : null}
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
            borderWidth: pinned ? 3 : 1,
            borderColor: pinned ? "rgba(55,214,192,0.55)" : "rgba(255,255,255,0.06)",
          }}
        />

        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: radius,
            borderWidth: compact ? 3 : 4,
            borderColor: "#37D6C0",
            opacity: speakingGlow,
          }}
        />

        <View pointerEvents="none" style={{ position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 4 }}>
          {participant.locallyMuted ? (
            <View
              accessibilityLabel="Silenciado para vos"
              style={{
                width: badgeSize,
                height: badgeSize,
                borderRadius: 9999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(10,22,32,0.72)",
              }}
            >
              <Ionicons name="volume-mute" size={compact ? 11 : 14} color="#F0C24B" />
            </View>
          ) : null}
          {speaking ? <SpeakingIndicator compact={compact} /> : null}
          {!participant.micEnabled ? (
            <View
              style={{
                width: badgeSize,
                height: badgeSize,
                borderRadius: 9999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(10,22,32,0.72)",
              }}
            >
              <Ionicons name="mic-off" size={compact ? 11 : 14} color="#FF7F72" />
            </View>
          ) : null}
        </View>

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
          {participant.isScreen ? <Ionicons name="desktop-outline" size={11} color="#37D6C0" /> : null}
          <Text numberOfLines={1} style={{ color: "#F2F7F7", fontSize: compact ? 10.5 : 12, fontWeight: "600", flexShrink: 1 }}>
            {participant.isLocal && !participant.isScreen ? `${participant.name} (vos)` : participant.name}
          </Text>
        </View>
      </Pressable>

      {showControls ? (
        <View style={{ position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 6 }}>
          <Pressable
            onPress={() => {
              setTouched(false)
              onTogglePin()
            }}
            onHoverIn={hoverIn}
            onHoverOut={hoverOut}
            accessibilityLabel={pinned ? `Dejar de fijar a ${participant.name}` : `Fijar a ${participant.name}`}
            style={{
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
          {participant.isLocal || participant.isScreen ? null : (
            <Pressable
              onPress={() => {
                setTouched(false)
                onToggleLocalMute()
              }}
              onHoverIn={hoverIn}
              onHoverOut={hoverOut}
              accessibilityLabel={
                participant.locallyMuted ? `Volver a escuchar a ${participant.name}` : `Silenciar a ${participant.name} para vos`
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: compact ? 8 : 11,
                paddingVertical: compact ? 6 : 7,
                borderRadius: 9999,
                backgroundColor: participant.locallyMuted ? "#F0C24B" : "rgba(10,22,32,0.82)",
              }}
            >
              <Ionicons
                name={participant.locallyMuted ? "volume-high" : "volume-mute"}
                size={14}
                color={participant.locallyMuted ? "#2A1F00" : "#E6F3F3"}
              />
              {compact ? null : (
                <Text style={{ color: participant.locallyMuted ? "#2A1F00" : "#E6F3F3", fontSize: 11.5, fontWeight: "700" }}>
                  {participant.locallyMuted ? "Volver a escuchar" : "Silenciar para mí"}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  )
}

function OverflowTile({ hidden, height }: { hidden: VoiceParticipant[]; height: number }) {
  const shown = hidden.slice(0, 3)
  const avatarSize = Math.round(Math.max(24, Math.min(52, height * 0.26)))
  return (
    <View
      style={{
        width: "100%",
        height: "100%",
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

function screenEntry(owner: VoiceParticipant): VoiceParticipant {
  return {
    ...owner,
    id: `${owner.id}:screen`,
    name: owner.isLocal ? "Tu pantalla" : `Pantalla de ${owner.name}`,
    isScreen: true,
    camEnabled: true,
    videoTrack: owner.screenTrack,
    micEnabled: true,
    speaking: false,
    locallyMuted: false,
    audioTrack: null,
  }
}

type Frame = { x: number; y: number; w: number; h: number }

type StageItem = {
  key: string
  frame: Frame
  compact: boolean
  participant?: VoiceParticipant
  hidden?: VoiceParticipant[]
}

function AnimatedFrame({
  frame,
  leaving,
  instant,
  zIndex,
  children,
}: {
  frame: Frame
  leaving: boolean
  instant: boolean
  zIndex: number
  children: React.ReactNode
}) {
  const anim = useRef({
    x: new Animated.Value(frame.x),
    y: new Animated.Value(frame.y),
    w: new Animated.Value(frame.w),
    h: new Animated.Value(frame.h),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0.9),
  }).current

  useEffect(() => {
    const targets: [Animated.Value, number][] = [
      [anim.x, frame.x],
      [anim.y, frame.y],
      [anim.w, frame.w],
      [anim.h, frame.h],
    ]
    if (instant) {
      targets.forEach(([value, to]) => value.setValue(to))
      return
    }
    const motion = Animated.parallel(
      targets.map(([value, to]) =>
        Animated.timing(value, { toValue: to, duration: MOVE_MS, easing: MOVE_EASING, useNativeDriver: false }),
      ),
    )
    motion.start()
    return () => motion.stop()
  }, [anim, frame.x, frame.y, frame.w, frame.h, instant])

  useEffect(() => {
    const fade = Animated.parallel([
      Animated.timing(anim.opacity, { toValue: leaving ? 0 : 1, duration: FADE_MS, easing: MOVE_EASING, useNativeDriver: false }),
      Animated.timing(anim.scale, { toValue: leaving ? 0.9 : 1, duration: FADE_MS, easing: MOVE_EASING, useNativeDriver: false }),
    ])
    fade.start()
    return () => fade.stop()
  }, [anim, leaving])

  return (
    <Animated.View
      pointerEvents={leaving ? "none" : "auto"}
      style={{
        position: "absolute",
        left: anim.x,
        top: anim.y,
        width: anim.w,
        height: anim.h,
        zIndex,
        opacity: anim.opacity,
        transform: [{ scale: anim.scale }],
      }}
    >
      {children}
    </Animated.View>
  )
}

function stackFrames(count: number, size: number, length: number, total: number) {
  const span = count * size + (count - 1) * GAP
  const start = (total - span) / 2
  return Array.from({ length: count }, (_, i) => ({ offset: start + i * (size + GAP), length }))
}

function stripItems(
  others: VoiceParticipant[],
  capacity: number,
  place: (offset: number) => Frame,
  thumbSize: number,
  total: number,
): StageItem[] {
  const overflow = others.length > capacity
  const shown = overflow ? others.slice(0, Math.max(0, capacity - 1)) : others
  const hidden = overflow ? others.slice(shown.length) : []
  const count = shown.length + (overflow ? 1 : 0)
  const slots = stackFrames(count, thumbSize, thumbSize, total)
  const items: StageItem[] = shown.map((p, i) => ({ key: p.id, participant: p, compact: true, frame: place(slots[i].offset) }))
  if (overflow) items.push({ key: "overflow", hidden, compact: true, frame: place(slots[count - 1].offset) })
  return items
}

function computeItems(
  participants: VoiceParticipant[],
  layout: VoiceLayout,
  main: VoiceParticipant,
  pinned: string | null,
  W: number,
  H: number,
  narrow: boolean,
): StageItem[] {
  if (layout === "spotlight") {
    const fit = fitInCell(W, H)
    return [{ key: main.id, participant: main, compact: false, frame: { x: (W - fit.w) / 2, y: (H - fit.h) / 2, w: fit.w, h: fit.h } }]
  }

  if (layout === "sidebar") {
    const others = participants.filter((p) => p.id !== main.id)
    if (W >= 600 && W >= H * 1.15) {
      const stripW = Math.min(260, Math.max(160, W * 0.22))
      const thumbH = stripW / RATIO
      const areaW = W - stripW - GAP
      const fit = fitInCell(areaW, H)
      const capacity = Math.max(1, Math.floor((H + GAP) / (thumbH + GAP)))
      return [
        { key: main.id, participant: main, compact: false, frame: { x: (areaW - fit.w) / 2, y: (H - fit.h) / 2, w: fit.w, h: fit.h } },
        ...stripItems(others, capacity, (offset) => ({ x: W - stripW, y: offset, w: stripW, h: thumbH }), thumbH, H),
      ]
    }
    const thumbW = Math.min(Math.min(110, Math.max(72, H * 0.18)) * RATIO, (W - GAP * 2) / 3)
    const stripH = thumbW / RATIO
    const areaH = H - stripH - GAP
    const fit = fitInCell(W, areaH)
    const capacity = Math.max(1, Math.floor((W + GAP) / (thumbW + GAP)))
    return [
      { key: main.id, participant: main, compact: false, frame: { x: (W - fit.w) / 2, y: (areaH - fit.h) / 2, w: fit.w, h: fit.h } },
      ...stripItems(others, capacity, (offset) => ({ x: offset, y: H - stripH, w: thumbW, h: stripH }), thumbW, W),
    ]
  }

  const ordered = pinned ? [main, ...participants.filter((p) => p.id !== main.id)] : participants
  const maxTiles = narrow ? 8 : 12
  const overflow = ordered.length > maxTiles
  const visible = overflow ? ordered.slice(0, maxTiles - 1) : ordered
  const hidden = overflow ? ordered.slice(maxTiles - 1) : []
  const count = visible.length + (overflow ? 1 : 0)
  const fit = fitGrid(count, W, H)
  const compact = fit.w < 260
  const rows = Math.ceil(count / fit.cols)
  const top = (H - (rows * fit.h + (rows - 1) * GAP)) / 2
  const frameAt = (index: number): Frame => {
    const row = Math.floor(index / fit.cols)
    const inRow = Math.min(fit.cols, count - row * fit.cols)
    const left = (W - (inRow * fit.w + (inRow - 1) * GAP)) / 2
    return { x: left + (index % fit.cols) * (fit.w + GAP), y: top + row * (fit.h + GAP), w: fit.w, h: fit.h }
  }
  const items: StageItem[] = visible.map((p, i) => ({ key: p.id, participant: p, compact, frame: frameAt(i) }))
  if (overflow) items.push({ key: "overflow", hidden, compact, frame: frameAt(count - 1) })
  return items
}

export default function VoiceStage({
  participants,
  layout,
  pinnedId,
  onTogglePin,
  onToggleLocalMute,
}: {
  participants: VoiceParticipant[]
  layout: VoiceLayout
  pinnedId: string | null
  onTogglePin: (id: string) => void
  onToggleLocalMute: (id: string) => void
}) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [ghosts, setGhosts] = useState<StageItem[]>([])
  const previousItems = useRef<StageItem[]>([])
  const lastSize = useRef(size)
  const ghostTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
  }

  const { width: W, height: H } = size
  const narrow = W > 0 && W < 600
  const entries = [...participants.filter((p) => p.screenTrack).map(screenEntry), ...participants]
  const pinned = entries.some((p) => p.id === pinnedId) ? pinnedId : null
  const main = pickMain(entries, pinned)
  const sharing = entries.some((p) => p.isScreen)
  const effective: VoiceLayout =
    entries.length <= 1 ? "mosaic" : layout === "auto" ? (pinned || sharing ? "sidebar" : "mosaic") : layout

  const items = W > 0 && H > 0 && main ? computeItems(entries, effective, main, pinned, W, H, narrow) : []
  const liveKeys = new Set(items.map((item) => item.key))
  const instant = lastSize.current !== size

  useEffect(() => {
    lastSize.current = size
  }, [size])

  useEffect(() => {
    const keys = new Set(items.map((item) => item.key))
    const gone = previousItems.current.filter((item) => !keys.has(item.key))
    previousItems.current = items
    if (gone.length === 0) return
    const goneKeys = new Set(gone.map((item) => item.key))
    setGhosts((current) => [...current.filter((g) => !goneKeys.has(g.key) && !keys.has(g.key)), ...gone])
    ghostTimers.current.push(
      setTimeout(() => setGhosts((current) => current.filter((g) => !gone.includes(g))), FADE_MS + 40),
    )
  })

  useEffect(
    () => () => {
      ghostTimers.current.forEach(clearTimeout)
    },
    [],
  )

  const rendered = [
    ...ghosts.filter((g) => !liveKeys.has(g.key)).map((item) => ({ item, leaving: true })),
    ...items.map((item) => ({ item, leaving: false })),
  ].sort((a, b) => (a.item.key < b.item.key ? -1 : a.item.key > b.item.key ? 1 : 0))

  return (
    <View style={{ flex: 1, padding: narrow ? 8 : 14 }}>
      <View onLayout={onLayout} style={{ flex: 1 }}>
        {rendered.map(({ item, leaving }) => (
          <AnimatedFrame
            key={item.key}
            frame={item.frame}
            leaving={leaving}
            instant={instant}
            zIndex={leaving ? 0 : item.participant && item.participant.id === main?.id ? 2 : 1}
          >
            {item.participant ? (
              <Tile
                participant={item.participant}
                width={item.frame.w}
                height={item.frame.h}
                compact={item.compact}
                pinned={item.participant.id === pinned}
                onTogglePin={() => onTogglePin(item.participant!.id)}
                onToggleLocalMute={() => onToggleLocalMute(item.participant!.id)}
              />
            ) : (
              <OverflowTile hidden={item.hidden ?? []} height={item.frame.h} />
            )}
          </AnimatedFrame>
        ))}
      </View>
    </View>
  )
}
