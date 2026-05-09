interface TierProgressProps {
  weeklySalesTotal: number
  nextTierMinAmount: number
}

export function TierProgress({ weeklySalesTotal, nextTierMinAmount }: TierProgressProps) {
  const pct = Math.min(100, (weeklySalesTotal / nextTierMinAmount) * 100)

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>¥{weeklySalesTotal.toFixed(2)}</span>
        <span>¥{nextTierMinAmount.toFixed(2)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
