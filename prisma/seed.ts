/**
 * Database seed script
 *
 * Creates the initial admin account directly via Prisma + better-auth crypto.
 * This bypasses the disableSignUp restriction on the HTTP endpoint.
 *
 * Run with: npx tsx prisma/seed.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";
import { config } from "../lib/config";

async function seed() {
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding database...");
  console.log(`  Creating admin account: ${config.adminEmail}`);

  try {
    // Check if admin already exists
    const existing = await prisma.user.findUnique({
      where: { email: config.adminEmail },
    });

    if (existing) {
      console.log("  ✅ Admin account already exists, skipping.");
    } else {
      const now = new Date();
      const hashedPassword = await hashPassword(config.adminPassword);

      const user = await prisma.user.create({
        data: {
          email: config.adminEmail,
          name: config.adminName,
          emailVerified: true,
          role: "ADMIN",
          createdAt: now,
          updatedAt: now,
        },
      });

      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        },
      });

      console.log("  ✅ Admin account created successfully!");
      console.log("");
      console.log("  ╔══════════════════════════════════════╗");
      console.log(`  ║  Email:    ${config.adminEmail.padEnd(26)}║`);
      console.log(`  ║  Password: ${config.adminPassword.padEnd(26)}║`);
      console.log("  ╚══════════════════════════════════════╝");
      console.log("");
      console.log("  ⚠️  Please change the password after first login!");
    }
  } catch (error) {
    console.error("  ❌ Failed to create admin account:", error);
    process.exit(1);
  }

  // 阶梯佣金预设：L1–L5 固定档位（若无任何档位则写入）
  const tierCount = await prisma.commissionTier.count();
  if (tierCount === 0) {
    console.log("  Seeding commission tier presets (L1–L5)...");
    const presets = [
      { minAmount: 0, maxAmount: 400, ratePercent: 52, sortOrder: 0 }, // L1 0-400 约52%
      { minAmount: 400, maxAmount: 1200, ratePercent: 63, sortOrder: 1 }, // L2 400-1200 约63%
      { minAmount: 1200, maxAmount: 3000, ratePercent: 74, sortOrder: 2 }, // L3 1200-3000 约74%
      { minAmount: 3000, maxAmount: 7600, ratePercent: 84, sortOrder: 3 }, // L4 3000-7600 约84%
      {
        minAmount: 7600,
        maxAmount: 99_999_999.99,
        ratePercent: 89,
        sortOrder: 4,
      }, // L5 >=7600 约89%
    ];
    await prisma.commissionTier.createMany({ data: presets });
    console.log("  ✅ Commission tier presets (L1–L5) created.");
  }

  if (process.env.SEED_E2E === "1") {
    console.log("  Seeding E2E shared data (distributor, guide)...");
    try {
      // 商品和卡密由各测试文件 beforeAll/afterAll 自行管理，此处仅创建共享的用户和指南数据

      const e2eDistributorEmail = "e2e-distributor@example.com";
      const e2eDistributorPassword = "e2e-distributor-password";
      let distUser = await prisma.user.findUnique({
        where: { email: e2eDistributorEmail },
      });
      if (!distUser) {
        const now = new Date();
        const distPasswordHash = await hashPassword(e2eDistributorPassword);
        distUser = await prisma.user.create({
          data: {
            email: e2eDistributorEmail,
            name: "E2E Distributor",
            emailVerified: true,
            role: "DISTRIBUTOR",
            distributorCode: "E2EDIST",
            createdAt: now,
            updatedAt: now,
          },
        });
        await prisma.account.create({
          data: {
            userId: distUser.id,
            accountId: distUser.id,
            providerId: "credential",
            password: distPasswordHash,
            createdAt: now,
            updatedAt: now,
          },
        });
        console.log(
          "  ✅ E2E distributor created (e2e-distributor@example.com).",
        );
      }

      try {
        const guideCount = await prisma.distributorGuide.count({
          where: { status: "PUBLISHED" },
        });
        if (guideCount === 0) {
          await prisma.distributorGuide.create({
            data: {
              title: "E2E 入门指南",
              content: "## 示例\n\n```\n可复制的话术内容\n```",
              status: "PUBLISHED",
              publishedAt: new Date(),
              sortOrder: 0,
            },
          });
          console.log("  ✅ E2E distributor guide created.");
        }
      } catch (guideErr) {
        const err = guideErr as { code?: string };
        if (err?.code === "P2021") {
          console.log(
            "  ⏭️  DistributorGuide table missing; run prisma migrate deploy first. Skipping E2E guide.",
          );
        } else {
          throw guideErr;
        }
      }
    } catch (e2eError) {
      console.error("  ❌ E2E seed failed:", e2eError);
      process.exit(1);
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

seed();
