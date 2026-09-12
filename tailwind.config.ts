/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#0A1620",
        surface: "rgba(255,255,255,0.055)",
        "surface-2": "rgba(255,255,255,0.10)",
        "surface-3": "rgba(255,255,255,0.15)",
        border: "rgba(255,255,255,0.13)",
        "border-2": "rgba(255,255,255,0.24)",
        text: "#E6F3F3",
        muted: "#8DA8AC",
        subtle: "#5E7E82",
        primary: "#37D6C0",
        "primary-h": "#2BC4AF",
        "primary-d": "rgba(55,214,192,0.17)",
        "primary-ink": "#04211D",
        accent: "#F0C24B",
        "accent-d": "rgba(240,194,75,0.15)",
        danger: "#FF7F72",
        "danger-d": "rgba(255,127,114,0.15)",
        success: "#4FD69C",
        "success-d": "rgba(79,214,156,0.15)",
        online: "#4FD69C",
        away: "#F0C24B",
        offline: "rgba(255,255,255,0.24)",
        sel: "rgba(55,214,192,0.15)",
      },
      borderRadius: {
        card: "18px",
      },
      fontFamily: {
        sans: ["System"],
        mono: ["SpaceMono"],
      },
    },
  },
  plugins: [],
};
