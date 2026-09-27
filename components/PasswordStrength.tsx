import { View, Text } from "react-native"

export function getPasswordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
  }
}

export function isPasswordStrongEnough(pw: string): boolean {
  return Object.values(getPasswordChecks(pw)).every(Boolean)
}

export function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: met ? "#4FD69C" : "rgba(255,255,255,0.13)",
        }}
      >
        <Text style={{ fontSize: 7, fontWeight: "800", color: met ? "#0A1620" : "#8DA8AC" }}>
          {met ? "✓" : "–"}
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: met ? "#4FD69C" : "#8DA8AC" }}>{text}</Text>
    </View>
  )
}

export function PasswordStrengthMeter({ pw }: { pw: string }) {
  const checks = getPasswordChecks(pw)
  const metCount = Object.values(checks).filter(Boolean).length

  if (pw.length === 0) return null

  return (
    <>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor:
                i < metCount ? (metCount <= 2 ? "#F0C24B" : "#4FD69C") : "rgba(255,255,255,0.13)",
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 4, columnGap: 12, marginTop: 8, marginBottom: 12 }}>
        <PasswordRequirement met={checks.length} text="8 caracteres" />
        <PasswordRequirement met={checks.upper} text="Una mayúscula" />
        <PasswordRequirement met={checks.lower} text="Una minúscula" />
        <PasswordRequirement met={checks.number} text="Un número" />
      </View>
    </>
  )
}
