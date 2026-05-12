import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { AwaitingPaymentClient } from "./awaiting-payment-client"

export const dynamic = "force-dynamic"

export default async function AwaitingPaymentPage({
    params,
}: {
    params: Promise<{ orderNo: string }>
}) {
    const { orderNo } = await params
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1 px-4 py-12">
                <div className="mx-auto max-w-md">
                    <Suspense fallback={<AwaitingFallback />}>
                        <AwaitingPaymentClient orderNo={orderNo} />
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
