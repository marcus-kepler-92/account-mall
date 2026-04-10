import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

export async function createNoEmailInviteLink({
    inviterId,
}: {
    inviterId: string
}): Promise<{ link: string }> {
    const ttlDays = config.distributorInviteTtlDays
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
    const token = crypto.randomUUID()

    await prisma.distributorInvitation.create({
        data: { email: null, token, inviterId, expiresAt },
    })

    const link = `${config.siteUrl}/distributor/accept-invite?token=${token}`
    return { link }
}
