/**
 * Aggregates per-invitee sales totals from a flat order list, excluding
 * self-purchases (orders where the buyer email matches the invitee email).
 */
export function buildMilestoneCumulativeMap(
  orders: Array<{ distributorId: string | null; amount: unknown; email: string }>,
  invitees: Array<{ id: string; email: string | null }>,
): Map<string, number> {
  const emailMap = new Map(invitees.map((u) => [u.id, u.email?.toLowerCase() ?? null]))
  const result = new Map<string, number>()
  for (const o of orders) {
    if (!o.distributorId) continue
    const selfEmail = emailMap.get(o.distributorId)
    if (selfEmail && o.email.toLowerCase() === selfEmail) continue
    result.set(o.distributorId, (result.get(o.distributorId) ?? 0) + Number(o.amount))
  }
  return result
}
