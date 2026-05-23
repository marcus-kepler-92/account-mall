import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = [
    { status: "PENDING", label: "待付款" },
    { status: "AWAITING_FULFILLMENT", label: "待发货" },
    { status: "PROCESSING", label: "处理中" },
    { status: "COMPLETED", label: "已完成" },
] as const

type Status =
    | "PENDING"
    | "AWAITING_FULFILLMENT"
    | "PROCESSING"
    | "COMPLETED"
    | "CLOSED"

/**
 * Buyer-facing 5-state progress hint for MANUAL orders.
 *
 * Four happy-path steps render inline (待付款 → 待发货 → 处理中 → 已完成).
 * CLOSED short-circuits to a single muted message — the timeline is meaningless
 * for canceled orders, and forcing a final state into the same row leaks the
 * "successful" visual into a failed outcome.
 *
 * `etaText` (optional) renders trailing the steps; the page computes it server-
 * side from business-hours so this component stays pure / safe to use inside RSC.
 */
export function ManualStatusTimeline({
    current,
    etaText,
}: {
    current: Status
    etaText?: string
}) {
    if (current === "CLOSED") {
        return (
            <div className="text-sm text-muted-foreground">
                订单已关闭，如有疑问联系客服。
            </div>
        )
    }
    const currentIdx = STEPS.findIndex((s) => s.status === current)
    return (
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {STEPS.map((s, i) => {
                const done = i < currentIdx
                const active = i === currentIdx
                return (
                    <li
                        key={s.status}
                        className={cn(
                            "flex items-center gap-1",
                            done
                                ? "text-foreground"
                                : active
                                  ? "text-primary"
                                  : "text-muted-foreground",
                        )}
                    >
                        {done ? (
                            <CheckCircle2 className="size-4" />
                        ) : active ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Circle className="size-4" />
                        )}
                        <span>{s.label}</span>
                        {i < STEPS.length - 1 && (
                            <span className="mx-1 text-muted-foreground">›</span>
                        )}
                    </li>
                )
            })}
            {etaText && (
                <li className="ml-1 text-xs text-muted-foreground">{etaText}</li>
            )}
        </ol>
    )
}
