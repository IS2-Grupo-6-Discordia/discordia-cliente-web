import { api } from "./client"
import type { Message } from "./types"

const USE_MOCK = true

// Demo messages, distinct per channel, and only for the example server's
// channels. Any other channel id (a server the user created or joined) resolves
// to an empty history via the `?? []` fallback below.
const MOCK_MESSAGES: Record<string, Message[]> = {
  anuncios: [
    {
      id: "an-1",
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
      id: "an-2",
      author: "Juanpi",
      color: "#F0C24B",
      time: "14:05",
      role: "Moderación",
      roleColor: "#F0C24B",
      text: "Lo miro hoy.",
      mentionRole: "backend",
    },
    {
      id: "an-3",
      author: "Facundo",
      color: "#37D6C0",
      time: "14:07",
      edited: true,
      text: "Separo /livez y /readyz esta tarde y lo dejo en un PR aparte.",
    },
  ],
  general: [
    {
      id: "ge-1",
      author: "Tomás S.",
      color: "#4FD69C",
      time: "09:12",
      text: "Buen día gente 👋 ¿alguien arrancó con el TP de esta semana?",
    },
    {
      id: "ge-2",
      author: "Nadia V.",
      color: "#FF7F72",
      time: "09:20",
      text: "Yo esta tarde. Si querés lo hacemos en una call.",
      reactions: [{ emoji: "🙌", count: 3, mine: true }],
    },
    {
      id: "ge-3",
      author: "Facundo",
      color: "#37D6C0",
      time: "09:24",
      text: "Dale, después coordinamos por acá.",
    },
  ],
  "checkpoint-2": [
    {
      id: "cp-1",
      author: "Mora B.",
      color: "#37D6C0",
      time: "11:40",
      role: "Owner",
      roleColor: "#37D6C0",
      text: "Recordatorio: el checkpoint 2 se entrega el viernes a las 23:59.",
      reactions: [{ emoji: "⏰", count: 5 }],
    },
    {
      id: "cp-2",
      author: "Lucía R.",
      color: "#A093FF",
      time: "11:58",
      role: "Moderación",
      roleColor: "#F0C24B",
      text: "Subí la rúbrica al canal #recursos así la tienen a mano.",
    },
    {
      id: "cp-3",
      author: "Juanpi",
      color: "#F0C24B",
      time: "12:15",
      text: "Nos falta cerrar el diagrama de secuencia. ¿Alguien lo agarra?",
      mentionRole: "equipo",
    },
  ],
  recursos: [
    {
      id: "re-1",
      author: "Lucía R.",
      color: "#A093FF",
      time: "10:03",
      role: "Moderación",
      roleColor: "#F0C24B",
      text: "Rúbrica del checkpoint 2 y el template del informe: los dejo fijados acá.",
      reactions: [{ emoji: "📌", count: 6, mine: true }],
    },
    {
      id: "re-2",
      author: "Tomás S.",
      color: "#4FD69C",
      time: "10:31",
      text: "Sumo el link a los apuntes de la clase de arquitectura 👇",
    },
  ],
}

export async function getMessages(channelId: string): Promise<Message[]> {
  if (USE_MOCK) return MOCK_MESSAGES[channelId] ?? []
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
