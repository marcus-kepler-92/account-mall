import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { getSiteSettings } from "@/lib/site-settings"
import { isWithinBusinessHours, formatEtaText } from "@/lib/business-hours"
import { AwaitingPaymentClient } from "./awaiting-payment-client"

export const dynamic = "force-dynamic"

export default async function AwaitingPaymentPage({
    params,
}: {
    params: Promise<{ orderNo: string }>
}) {
    const { orderNo } = await params

    // Pre-compute ETA hint server-side: business-hours is a DB-backed helper and
    // must not be imported from a client bundle. The buyer may transition into
    // AWAITING_FULFILLMENT mid-poll (MANUAL path), at which point the timeline
    // surfaces this hint.
    const settings = await getSiteSettings()
    const cfg = {
        start: settings.businessHoursStart,
        end: settings.businessHoursEnd,
        weekdays: settings.businessHoursWeekdays,
        timezone: settings.businessHoursTimezone,
    }
    const now = new Date()
    const etaText = isWithinBusinessHours(now, cfg)
        ? "卖家通常在 15 分钟内发货"
        : formatEtaText(now, cfg)

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1 px-4 py-12">
                <div className="mx-auto max-w-md">
                    <Suspense fallback={<AwaitingFallback />}>
                        <AwaitingPaymentClient orderNo={orderNo} etaText={etaText} />
                    </Suspense>
                </div>
            </main>
        </div>
    )
}

function AwaitingFallback() {
    return (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-lg font-semibold">正在确认支付结果</p>
        </div>
    )
}
