import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native"

const GIS_SRC = "https://accounts.google.com/gsi/client"
const LOAD_TIMEOUT_MS = 8000
const GIS_BUTTON_HEIGHT = 40
const GOOGLE_G_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
)}`
export const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "357428623304-lnu4vkc3psjuocv2m984ic4tqglbpfes.apps.googleusercontent.com"

interface GoogleIdApi {
  initialize: (config: {
    client_id: string
    callback: (response: { credential?: string }) => void
    ux_mode?: "popup" | "redirect"
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } }
  }
}

let scriptPromise: Promise<GoogleIdApi> | null = null

function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    const timer = setTimeout(() => fail(new Error("timeout")), LOAD_TIMEOUT_MS)
    const fail = (error: Error) => {
      clearTimeout(timer)
      script.remove()
      scriptPromise = null
      reject(error)
    }
    script.onload = () => {
      clearTimeout(timer)
      const api = window.google?.accounts?.id
      if (api) resolve(api)
      else fail(new Error("unavailable"))
    }
    script.onerror = () => fail(new Error("unavailable"))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function isGoogleSignInAvailable(): boolean {
  return Platform.OS === "web"
}

interface GoogleSignInButtonProps {
  loading?: boolean
  onCredential: (idToken: string) => void
  onUnavailable: () => void
}

type LoadState = "loading" | "ready" | "failed"

export default function GoogleSignInButton({ loading, onCredential, onUnavailable }: GoogleSignInButtonProps) {
  const wrapperRef = useRef<View>(null)
  const overlayRef = useRef<View>(null)
  const callbacks = useRef({ onCredential, onUnavailable })
  callbacks.current = { onCredential, onUnavailable }
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [state, setState] = useState<LoadState>(GOOGLE_CLIENT_ID ? "loading" : "failed")
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || size.width <= 0) return
    let active = true
    loadGoogleIdentity()
      .then((api) => {
        const host = overlayRef.current as unknown as HTMLElement | null
        if (!active || !host) return
        api.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          cancel_on_tap_outside: true,
          callback: (response) => {
            if (response.credential) callbacks.current.onCredential(response.credential)
            else callbacks.current.onUnavailable()
          },
        })
        host.innerHTML = ""
        api.renderButton(host, {
          type: "standard",
          size: "large",
          text: "continue_with",
          locale: "es",
          width: Math.round(Math.min(400, Math.max(200, size.width))),
        })
        setState("ready")
      })
      .catch(() => {
        if (active) setState("failed")
      })
    return () => {
      active = false
    }
  }, [size.width])

  useEffect(() => {
    const wrapper = wrapperRef.current as unknown as HTMLElement | null
    if (Platform.OS !== "web" || !wrapper?.addEventListener) return
    const enter = () => setHovered(true)
    const leave = () => setHovered(false)
    wrapper.addEventListener("mouseenter", enter)
    wrapper.addEventListener("mouseleave", leave)
    return () => {
      wrapper.removeEventListener("mouseenter", enter)
      wrapper.removeEventListener("mouseleave", leave)
    }
  }, [])

  const handlePress = () => {
    if (state === "failed") callbacks.current.onUnavailable()
  }

  const overlayActive = state === "ready" && !loading

  return (
    <View
      ref={wrapperRef}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      style={{ width: "100%", position: "relative" }}
    >
      <Pressable
        onPress={handlePress}
        disabled={loading || state === "loading"}
        accessibilityRole="button"
        accessibilityLabel="Continuar con Google"
        style={{
          width: "100%",
          borderRadius: 10,
          paddingVertical: 13,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          backgroundColor: hovered && !loading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
          ...(Platform.OS === "web"
            ? ({ transitionProperty: "background-color", transitionDuration: "130ms" } as object)
            : {}),
        }}
      >
        {loading ? (
          <>
            <ActivityIndicator size="small" color="#8DA8AC" />
            <Text style={{ color: "#8DA8AC", fontWeight: "600", fontSize: 14 }}>Ingresando con Google...</Text>
          </>
        ) : (
          <>
            {Platform.OS === "web" ? <img src={GOOGLE_G_LOGO} width={18} height={18} alt="" draggable={false} /> : null}
            <Text style={{ color: "#E6F3F3", fontWeight: "600", fontSize: 14 }}>Continuar con Google</Text>
          </>
        )}
      </Pressable>

      {GOOGLE_CLIENT_ID && Platform.OS === "web" ? (
        <View
          ref={overlayRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: GIS_BUTTON_HEIGHT,
            overflow: "hidden",
            opacity: 0.0001,
            pointerEvents: overlayActive ? "auto" : "none",
            transform: [{ scaleY: size.height > 0 ? size.height / GIS_BUTTON_HEIGHT : 1 }],
            ...({ transformOrigin: "top", cursor: "pointer" } as object),
          }}
        />
      ) : null}
    </View>
  )
}
