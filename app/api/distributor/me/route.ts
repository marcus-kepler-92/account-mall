import { NextResponse } from "next/server";
import { getDistributorSession } from "@/lib/auth-guard";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api-response";

/** Natural week: Monday 00:00:00 UTC for the given date. */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const session = await getDistributorSession();
  if (!session) return unauthorized();

  const user = session.user as {
    id: string;
    email?: string;
    name?: string;
    distributorCode?: string | null;
  };
  let distributorCode = user.distributorCode;

  if (!distributorCode) {
    const code = `D${user.id.slice(-8).toUpperCase()}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { distributorCode: code },
    });
    distributorCode = code;
  }

  const promoUrl = `${config.siteUrl}/?promoCode=${encodeURIComponent(distributorCode)}`;

  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const [settledSum, paidSum, pendingSum, weekOrders, tiers] =
    await Promise.all([
      prisma.commission.aggregate({
        where: { distributorId: user.id, status: "SETTLED" },
        _sum: { amount: true },
      }),
      prisma.withdrawal.aggregate({
        where: { distributorId: user.id, status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.withdrawal.aggregate({
        where: { distributorId: user.id, status: "PENDING" },
        _sum: { amount: true },
      }),
      prisma.order.findMany({
        where: {
          distributorId: user.id,
          status: "COMPLETED",
          paidAt: { gte: weekStart, lt: weekEnd },
        },
        select: { amount: true },
      }),
      prisma.commissionTier.findMany({
        orderBy: { sortOrder: "asc" },
      }),
    ]);
  const withdrawableBalance =
    Number(settledSum._sum.amount ?? 0) -
    Number(paidSum._sum.amount ?? 0) -
    Number(pendingSum._sum.amount ?? 0);
  const weeklySalesTotal = weekOrders.reduce(
    (sum, o) => sum + Number(o.amount),
    0,
  );

  const tiersList = tiers.map((t) => ({
    minAmount: Number(t.minAmount),
    maxAmount: Number(t.maxAmount),
    ratePercent: Number(t.ratePercent),
    sortOrder: t.sortOrder,
  }));

  let currentTier: {
    minAmount: number;
    maxAmount: number;
    ratePercent: number;
    sortOrder: number;
  } | null = null;
  for (const t of tiers) {
    const min = Number(t.minAmount);
    const max = Number(t.maxAmount);
    if (weeklySalesTotal >= min && weeklySalesTotal < max) {
      currentTier = {
        minAmount: min,
        maxAmount: max,
        ratePercent: Number(t.ratePercent),
        sortOrder: t.sortOrder,
      };
      break;
    }
  }

  let nextTier: {
    minAmount: number;
    maxAmount: number;
    ratePercent: number;
    sortOrder: number;
  } | null = null;
  if (currentTier) {
    const next = tiers.find((t) => t.sortOrder > currentTier!.sortOrder);
    if (next) {
      nextTier = {
        minAmount: Number(next.minAmount),
        maxAmount: Number(next.maxAmount),
        ratePercent: Number(next.ratePercent),
        sortOrder: next.sortOrder,
      };
    }
  } else if (tiers.length > 0) {
    nextTier = {
      minAmount: Number(tiers[0].minAmount),
      maxAmount: Number(tiers[0].maxAmount),
      ratePercent: Number(tiers[0].ratePercent),
      sortOrder: tiers[0].sortOrder,
    };
  }

  let encouragementMessage: string;
  if (currentTier) {
    if (nextTier) {
      const gap = nextTier.minAmount - weeklySalesTotal;
      encouragementMessage = `再完成 ¥${gap.toFixed(2)} 即可晋级下一档（佣金比例 ${nextTier.ratePercent}%）`;
    } else {
      encouragementMessage = "您已处于最高档，继续保持！";
    }
  } else {
    if (nextTier) {
      const gap = nextTier.minAmount - weeklySalesTotal;
      encouragementMessage = `再完成 ¥${gap.toFixed(2)} 即可达到第一档（佣金比例 ${nextTier.ratePercent}%）`;
    } else {
      encouragementMessage = "暂无阶梯档位，完成订单即可获得基础佣金。";
    }
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    distributorCode,
    promoUrl,
    withdrawableBalance,
    weeklySalesTotal,
    currentTier,
    tiersList,
    nextTier,
    encouragementMessage,
  });
}
