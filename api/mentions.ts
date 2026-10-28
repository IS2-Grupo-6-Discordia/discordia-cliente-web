import type { Member } from "./types"

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function mentionPattern(label: string): RegExp {
  
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@${escapeRegExp(label)}(?![\\p{L}\\p{N}_])`, "iu")
}

export function extractMentionIds(text: string, members: Member[], selfId?: string): string[] {
  if (!text.includes("@")) return []
  const candidates = members.filter((m) => m.id && m.id !== selfId && m.name.trim())

  const firstNameCount = new Map<string, number>()
  for (const m of candidates) {
    const first = m.name.trim().split(/\s+/)[0].toLowerCase()
    firstNameCount.set(first, (firstNameCount.get(first) ?? 0) + 1)
  }

  const found = new Set<string>()
  const byLength = [...candidates].sort((a, b) => b.name.length - a.name.length)
  let remaining = text
  for (const m of byLength) {
    const full = m.name.trim()
    const pattern = mentionPattern(full)
    if (pattern.test(remaining)) {
      found.add(m.id)
      remaining = remaining.replace(new RegExp(pattern.source, "giu"), "$1")
    }
  }
  for (const m of byLength) {
    if (found.has(m.id)) continue
    const first = m.name.trim().split(/\s+/)[0]
    if (firstNameCount.get(first.toLowerCase()) !== 1) continue
    if (mentionPattern(first).test(remaining)) found.add(m.id)
  }
  return [...found]
}
