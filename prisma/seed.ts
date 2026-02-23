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
        } else {
            const now = new Date()
            const hashedPassword = await hashPassword(config.adminPassword)

            const user = await prisma.user.create({
                data: {
                    email: config.adminEmail,
                    name: config.adminName,
                    emailVerified: true,
                    createdAt: now,
                    updatedAt: now,
                },
            })

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
        }
    } catch (error) {
        console.error('  ❌ Failed to create admin account:', error)
        process.exit(1)
    }

    if (process.env.SEED_E2E === '1') {
        console.log('  Seeding E2E product and cards...')
        try {
            // Close all PENDING orders and release cards so E2E is under MAX_PENDING_ORDERS_PER_IP and has stock
            const pendingOrders = await prisma.order.findMany({
                where: { status: 'PENDING' },
                select: { id: true },
            })
            if (pendingOrders.length > 0) {
                const ids = pendingOrders.map((o) => o.id)
                await prisma.$transaction([
                    prisma.card.updateMany({
                        where: { orderId: { in: ids } },
                        data: { status: 'UNSOLD', orderId: null },
                    }),
                    prisma.order.updateMany({
                        where: { id: { in: ids } },
                        data: { status: 'CLOSED' },
                    }),
                ])
                console.log(`  ✅ Closed ${pendingOrders.length} PENDING order(s) and released cards.`)
            }

            let product = await prisma.product.findUnique({
                where: { slug: 'e2e-product' },
            })
            if (!product) {
                product = await prisma.product.create({
                    data: {
                        name: 'E2E 测试商品',
                        slug: 'e2e-product',
                        description: 'For E2E payment flow tests',
                        price: 0.01,
                        maxQuantity: 5,
                        status: 'ACTIVE',
                    },
                })
                console.log('  ✅ E2E product created.')
            }
            const unsoldCount = await prisma.card.count({
                where: { productId: product.id, status: 'UNSOLD' },
            })
            const need = 5 - unsoldCount
            if (need > 0) {
                await prisma.card.createMany({
                    data: Array.from({ length: need }, (_, i) => ({
                        productId: product!.id,
                        content: `e2e-card-${unsoldCount + i + 1}`,
                        status: 'UNSOLD',
                    })),
                })
                console.log(`  ✅ E2E cards: ${need} added (total UNSOLD: 5).`)
            } else {
                console.log('  ✅ E2E product and cards already present.')
            }
        } catch (e2eError) {
            console.error('  ❌ E2E seed failed:', e2eError)
            process.exit(1)
        }
    }

    await prisma.$disconnect()
    await pool.end()
}

seed()
