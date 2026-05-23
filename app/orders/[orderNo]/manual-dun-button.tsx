"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Props = {
    orderId: string
    orderNo: string
    email: string
    password: string
    initialCooldownSeconds: number
    minAgeSeconds: number
    orderAgeSeconds: number
}

/**
 * Buyer-facing "催发货" button.
 *
 * Two independent timers gate the click:
 *   - `ageLeft`: how long until the order is old enough to dun the first time
 *     (SiteSettings.dunMinAgeMinutes — orderAgeSeconds, clamped at 0).
 *   - `cooldown`: time remaining on the inter-dun cooldown
 *     (SiteSettings.dunCooldownMinutes since the last dun).
 *
 * Both tick down once per second via a single shared interval. The label
 * prefers the age guard over the cooldown when both are active because the
 * age guard is the more user-friendly explanation ("订单刚下，X 秒后可催")
 * — the cooldown only matters once the order is old enough to dun.
 *
 * On success the server returns `cooldownRemainingSeconds`; we reseed
 * `cooldown` from that response so a server-side change to
 * dunCooldownMinutes is reflected without a page reload.
 */
export function ManualDunButton({
    orderId,
    orderNo,
    email,
    password,
    initialCooldownSeconds,
    minAgeSeconds,
    orderAgeSeconds,
}: Props) {
    const [cooldown, setCooldown] = useState(initialCooldownSeconds)
    const [ageLeft, setAgeLeft] = useState(
        Math.max(0, minAgeSeconds - orderAgeSeconds),
    )
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        const t = setInterval(() => {
            setCooldown((s) => Math.max(0, s - 1))
            setAgeLeft((s) => Math.max(0, s - 1))
        }, 1000)
        return () => clearInterval(t)
    }, [])

    const blocked = cooldown > 0 || ageLeft > 0

    const onClick = async () => {
        if (blocked || busy) return
        setBusy(true)
        try {
            const res = await fetch(
                `/api/orders/${encodeURIComponent(orderId)}/dun`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderNo, email, password }),
                },
            )
            if (res.status === 429) {
                const j = await res.json().catch(() => ({}))
                toast.error(j.error ?? "请稍后再试")
                return
            }
            if (!res.ok) {
                toast.error("催发货失败")
                return
            }
            const j = (await res.json()) as { cooldownRemainingSeconds?: number }
            setCooldown(j.cooldownRemainingSeconds ?? 1800)
            toast.success("提醒已发出")
        } catch {
            toast.error("网络错误，请稍后重试")
        } finally {
            setBusy(false)
        }
    }

    const label =
        ageLeft > 0
            ? `订单刚下，${ageLeft}s 后可催`
            : cooldown > 0
              ? `${cooldown}s 后可催`
              : "催发货"

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={blocked || busy}
            onClick={onClick}
        >
            {label}
        </Button>
    )
}
