import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from '@/lib/config'

// Use global singleton to prevent multiple instances in Next.js dev mode
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient() {
    const adapter = new PrismaPg({ connectionString: config.databaseUrl })
    return new PrismaClient({ adapter })
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (config.nodeEnv !== 'production') globalForPrisma.prisma = prisma

export { prisma }