import type { ReactNode } from "react"
import { Pressable, Platform } from "react-native"
import type { StyleProp, ViewStyle } from "react-native"

interface PressableScaleProps {
  onPress?: () => void
  disabled?: boolean
  accessibilityLabel?: string
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number }
  style?: StyleProp<ViewStyle>
  // Extra style merged in only while hovered (web only).
  hoverStyle?: ViewStyle
  // How far the element scales down while pressed.
  pressedScale?: number
  children?: ReactNode
}

// Web-only CSS transition so scale / color / border changes animate smoothly.
// On native these keys are ignored and the scale simply applies without a tween.
const TRANSITION =
  Platform.OS === "web"
    ? ({
        transitionProperty: "transform, background-color, border-color, opacity",
        transitionDuration: "130ms",
        transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
      } as object)
    : {}

// A near drop-in replacement for TouchableOpacity that adds press-scale feedback
// and (on web) a hover state. This is what gives buttons and rows "life".
export default function PressableScale({
  onPress,
  disabled,
  accessibilityLabel,
  hitSlop,
  style,
  hoverStyle,
  pressedScale = 0.97,
  children,
}: PressableScaleProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        style,
        hovered && !disabled ? hoverStyle : null,
        TRANSITION,
        { transform: [{ scale: pressed && !disabled ? pressedScale : 1 }] },
      ]}
    >
      {children}
    </Pressable>
  )
}
