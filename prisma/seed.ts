/**
 * Database seed script
 *
 * Creates the initial admin account directly via Prisma + better-auth crypto.
 * This bypasses the disableSignUp restriction on the HTTP endpoint.
 *
 * Run with: npx tsx prisma/seed.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { hashPassword } from 'better-auth/crypto'
import { config } from '../lib/config'

async function seed() {
    const pool = new pg.Pool({ connectionString: config.databaseUrl })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    console.log('🌱 Seeding database...')
    console.log(`  Creating admin account: ${config.adminEmail}`)

    try {
        // Check if admin already exists
        const existing = await prisma.user.findUnique({
            where: { email: config.adminEmail },
        })

        if (existing) {
            console.log('  ✅ Admin account already exists, skipping.')
            return
        }

        const now = new Date()
        const hashedPassword = await hashPassword(config.adminPassword)

        // Create user
        const user = await prisma.user.create({
            data: {
                email: config.adminEmail,
                name: config.adminName,
                emailVerified: true,
                createdAt: now,
                updatedAt: now,
            },
        })

        // Create credential account (better-auth convention)
        await prisma.account.create({
            data: {
                userId: user.id,
                accountId: user.id,
                providerId: 'credential',
                password: hashedPassword,
                createdAt: now,
                updatedAt: now,
            },
        })

        console.log('  ✅ Admin account created successfully!')
        console.log('')
        console.log('  ╔══════════════════════════════════════╗')
        console.log(`  ║  Email:    ${config.adminEmail.padEnd(26)}║`)
        console.log(`  ║  Password: ${config.adminPassword.padEnd(26)}║`)
        console.log('  ╚══════════════════════════════════════╝')
        console.log('')
        console.log('  ⚠️  Please change the password after first login!')
    } catch (error) {
        console.error('  ❌ Failed to create admin account:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
        await pool.end()
    }
}

seed()
