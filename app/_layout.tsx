import { Slot } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Platform } from "react-native"
import { AuthProvider } from "@/context/AuthContext"

// Web-only: browser autofill repaints inputs with a light background and dark
// text, which breaks the dark theme. Override it once, globally.
if (
  Platform.OS === "web" &&
  typeof document !== "undefined" &&
  !document.getElementById("discordia-web-fixes")
) {
  const style = document.createElement("style")
  style.id = "discordia-web-fixes"
  style.textContent = `
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus,
    textarea:-webkit-autofill {
      -webkit-text-fill-color: #E6F3F3 !important;
      -webkit-box-shadow: 0 0 0 1000px #12222E inset !important;
      caret-color: #E6F3F3 !important;
      transition: background-color 9999s ease-in-out 0s;
    }
  `
  document.head.appendChild(style)
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Slot />
    </AuthProvider>
  )
}
