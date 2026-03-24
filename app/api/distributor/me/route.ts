import { NextResponse } from "next/server";
import { getDistributorSession } from "@/lib/auth-guard";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api-response";
import { getDistributorTierSummary } from "@/lib/distributor-tier-summary";

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
  const level2Rate = config.level2CommissionRatePercent;

  const [settledSum, paidSum, pendingSum, tierSummary] = await Promise.all([
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
    getDistributorTierSummary(user.id, level2Rate),
  ]);

  const withdrawableBalance =
    Number(settledSum._sum.amount ?? 0) -
    Number(paidSum._sum.amount ?? 0) -
    Number(pendingSum._sum.amount ?? 0);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    distributorCode,
    promoUrl,
    withdrawableBalance,
    weeklySalesTotal: tierSummary.weeklySalesTotal,
    currentTier: tierSummary.currentTier,
    tiersList: tierSummary.tiersList,
    nextTier: tierSummary.nextTier,
    encouragementMessage: tierSummary.encouragementMessage,
  });
}
