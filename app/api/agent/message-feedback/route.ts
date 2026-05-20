import { prisma } from "@/lib/prisma"
import { z } from "zod"

export const runtime = "nodejs"

const schema = z.object({
  messageId: z.string().min(1),
  value: z.enum(["up", "down"]),
})

const MAP = { up: "POSITIVE", down: "NEGATIVE" } as const

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return new Response(null, { status: 400 })

  await prisma.agentMessage.update({
    where: { id: parsed.data.messageId },
    data: { feedback: MAP[parsed.data.value] },
  })
  return new Response(null, { status: 204 })
}
