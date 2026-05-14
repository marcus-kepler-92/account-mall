export function computeInviteeTierInfo(
  weeklySales: number,
  tiers: { minAmount: number; maxAmount: number; ratePercent: number }[]
): { tierLabel: string | null; nextTierMinAmount: number | null } {
  let foundIdx = -1
  for (let i = 0; i < tiers.length; i++) {
    if (weeklySales >= tiers[i].minAmount && weeklySales < tiers[i].maxAmount) {
      foundIdx = i
      break
    }
  }
  if (foundIdx === -1 && tiers.length > 0) foundIdx = tiers.length - 1
  const tierLabel = foundIdx >= 0 ? `第${foundIdx + 1}档·${tiers[foundIdx].ratePercent}%` : null
  const nextTierMinAmount =
    foundIdx >= 0 && foundIdx + 1 < tiers.length ? tiers[foundIdx + 1].minAmount : null
  return { tierLabel, nextTierMinAmount }
}
