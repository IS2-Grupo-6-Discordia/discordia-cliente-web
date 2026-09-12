import { api } from "./client"
import type { Message } from "./types"

const USE_MOCK = !process.env.EXPO_PUBLIC_API_URL

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    author: "Mora B.",
    color: "#37D6C0",
    time: "14:02",
    role: "Owner",
    roleColor: "#37D6C0",
    text: "Subí el ADR del gateway al repo. Falta la sección de alternativas descartadas.",
    reactions: [
      { emoji: "👍", count: 4 },
      { emoji: "🚀", count: 2, mine: true },
    ],
  },
  {
    id: "2",
    author: "Juanpi",
    color: "#F0C24B",
    time: "14:05",
    role: "Moderación",
    roleColor: "#F0C24B",
    text: "Lo miro hoy.",
    mentionRole: "backend",
  },
  {
    id: "3",
    author: "Facundo",
    color: "#37D6C0",
    time: "14:07",
    edited: true,
    text: "Separo /livez y /readyz esta tarde y lo dejo en un PR aparte.",
  },
]

export async function getMessages(channelId: string): Promise<Message[]> {
  if (USE_MOCK) return MOCK_MESSAGES
  return api<Message[]>(`/channels/${channelId}/messages`)
}

export async function sendMessage(
  channelId: string,
  text: string,
): Promise<Message> {
  if (USE_MOCK) {
    const msg: Message = {
      id: Date.now().toString(),
      author: "Facundo",
      color: "#37D6C0",
      time: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      text,
    }
    return msg
  }

  return api<Message>(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  })
}
