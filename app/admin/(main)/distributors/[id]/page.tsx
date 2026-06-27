import { notFound } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getDistributorBasic } from "@/lib/domains/distributors"
import { DistributorDetailTabs } from "./distributor-detail-tabs"
import { OverviewTab } from "./overview-tab"
import { OrdersTab } from "./orders-tab"
import { CommissionsTab } from "./commissions-tab"
import { WithdrawalsTab } from "./withdrawals-tab"
import { TeamTab } from "./team-tab"

export const dynamic = "force-dynamic"

const TABS = ["overview", "orders", "commissions", "withdrawals", "team"] as const
type TabKey = (typeof TABS)[number]

type PageProps = {
    params: Promise<{ id: string }>
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function DistributorDetailPage({ params, searchParams }: PageProps) {
    const { id } = await params
    const sp = await searchParams
    const tab: TabKey = TABS.includes(sp.tab as TabKey) ? (sp.tab as TabKey) : "overview"

    const basic = await getDistributorBasic(id)
    if (!basic) notFound()

    const disabled = !!basic.disabledAt
    // Re-trigger the panel skeleton whenever the tab or its paging/sort changes.
    const tabKey = `${tab}:${sp.page ?? ""}:${sp.pageSize ?? ""}:${sp.status ?? ""}:${sp.sort ?? ""}:${sp.sortDir ?? ""}`

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/distributors">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-2xl font-bold tracking-tight">{basic.name}</h2>
                        <Badge variant={disabled ? "destructive" : "default"}>
                            {disabled ? "已停用" : "启用"}
                        </Badge>
                        {basic.distributorCode && (
                            <code className="text-sm font-mono text-muted-foreground">
                                {basic.distributorCode}
                            </code>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {basic.email ?? basic.username ?? "—"}
                    </p>
                </div>
            </div>

            <DistributorDetailTabs id={id} activeTab={tab} />

            <Suspense key={tabKey} fallback={<Skeleton className="h-[420px] w-full" />}>
                {tab === "overview" && <OverviewTab distributorId={id} />}
                {tab === "orders" && <OrdersTab distributorId={id} searchParams={sp} />}
                {tab === "commissions" && (
                    <CommissionsTab distributorId={id} searchParams={sp} />
                )}
                {tab === "withdrawals" && (
                    <WithdrawalsTab distributorId={id} searchParams={sp} />
                )}
                {tab === "team" && <TeamTab distributorId={id} />}
            </Suspense>
        </div>
    )
}
