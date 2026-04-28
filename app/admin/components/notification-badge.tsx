import { cn } from "@/lib/utils"

interface NotificationBadgeProps {
  count: number
  variant: "inline" | "dot"
  className?: string
}

export function NotificationBadge({ count, variant, className }: NotificationBadgeProps) {
  if (count <= 0) return null

  const display = count > 99 ? "99+" : String(count)

  if (variant === "inline") {
    return (
      <span
        role="status"
        aria-label={`${display} 项待处理`}
        className={cn(
          "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-white tabular-nums",
          className
        )}
      >
        {display}
      </span>
    )
  }

  return (
    <span
      role="status"
      aria-label={`${display} 项待处理`}
      className={cn(
        "absolute -top-1 -right-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-none text-white ring-2 ring-background",
        className
      )}
    >
      {display}
    </span>
  )
}
