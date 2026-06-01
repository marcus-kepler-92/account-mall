import { redirect } from "next/navigation"
import Link from "next/link"
import { Info, TrendingUp, ExternalLink } from "lucide-react"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { getDistributorTierSummary } from "@/lib/distributor-tier-summary"
import { estimateProductCommission, type ProductCommissionEstimate } from "@/lib/distributor-product-disclosure"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

type DisclosureRow = {
    id: string
    name: string
    slug: string
    price: number
    estimate: ProductCommissionEstimate
}

export default async function DistributorProductsPage() {
    const session = await getDistributorSession()
    if (!session) {
        redirect("/distributor/login")
    }
    const user = session.user as { id: string; distributorCode?: string | null }

    // Promo links carry the distributor's code so a clicked product opens the
    // page tied to *their* attribution. Mirror the dashboard: lazily mint a code
    // if the account doesn't have one yet.
    let distributorCode = user.distributorCode
    if (!distributorCode) {
        distributorCode = `D${user.id.slice(-8).toUpperCase()}`
        await prisma.user.update({ where: { id: user.id }, data: { distributorCode } })
    }

    const level2Rate = config.level2CommissionRatePercent

    const [products, tierSummary] = await Promise.all([
        prisma.product.findMany({
            where: { status: "ACTIVE" },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                commissionMode: true,
                commissionValue: true,
            },
        }),
        getDistributorTierSummary(user.id, level2Rate),
    ])

    const rows: DisclosureRow[] = products.map((p) => {
        const price = Number(p.price)
        return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            price,
            estimate: estimateProductCommission(
                {
                    price,
                    commissionMode: p.commissionMode,
                    commissionValue: p.commissionValue != null ? Number(p.commissionValue) : null,
                },
                tierSummary,
                level2Rate,
            ),
        }
    })

    const participating = rows.filter((r) => r.estimate.participating)
    const excluded = rows.filter((r) => !r.estimate.participating)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">分销产品公示</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    平台全部在售产品的分销规则一览——哪些参与、佣金多少、你推广能赚多少，推广前先看清。
                </p>
            </div>

            {/* 规则交代：让分销员一眼看懂佣金怎么来的。 */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-2">
                <div className="flex items-center gap-1.5 font-medium">
                    <Info className="size-4 text-primary" />
                    分销结算规则
                </div>
                <ul className="space-y-1 text-muted-foreground [&>li]:flex [&>li]:gap-1.5 [&>li]:before:content-['·'] [&>li]:before:text-muted-foreground/60">
                    <li>
                        <span><span className="text-foreground font-medium">全局阶梯</span>：本周卖得越多佣金比例越高，下方按你当前档实时预估。</span>
                    </li>
                    <li>
                        <span><span className="text-foreground font-medium">固定金额 / 售价百分比</span>：按产品单独设定，不随销量变化。</span>
                    </li>
                    <li><span>自购不计佣金；佣金于订单完成后结算。</span></li>
                    {tierSummary.hasInviter && (
                        <li><span>你有上级，下方佣金比例与收益均已扣除 20% 团队分成（归你的上级）。</span></li>
                    )}
                </ul>
            </div>

            {/* ── 参与分销 ── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-success" />
                    <h2 className="text-sm font-semibold">参与分销</h2>
                    <span className="text-xs text-muted-foreground">{participating.length} 个</span>
                </div>

                {participating.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">暂无参与分销的产品</p>
                ) : (
                    <div className="space-y-2.5">
                        {participating.map((row) => {
                            const e = row.estimate
                            return (
                                <Card
                                    key={row.id}
                                    className="py-0 transition-shadow hover:shadow-md"
                                >
                                    <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                                        {/* 商品信息：名称（点击带推广码看详情）+ 结算方式 + 佣金率/售价 */}
                                        <div className="min-w-0 space-y-2 md:flex-1">
                                            <Link
                                                href={`/products/${row.slug}?promoCode=${encodeURIComponent(distributorCode)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group/link inline-flex items-center gap-1 font-medium leading-snug hover:text-primary"
                                            >
                                                <span className="group-hover/link:underline">{row.name}</span>
                                                <ExternalLink className="size-3 shrink-0 text-muted-foreground/50 transition-colors group-hover/link:text-primary" />
                                            </Link>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                                <Badge variant="secondary" className="font-normal">
                                                    {e.modeLabel}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {e.ratePercent != null && (
                                                        <>
                                                            佣金{" "}
                                                            <span className="font-medium text-foreground tabular-nums">{e.ratePercent}%</span>
                                                            {e.rateNote && <span>（{e.rateNote}）</span>}
                                                            {" · "}
                                                        </>
                                                    )}
                                                    售价 <span className="tabular-nums">¥{row.price.toFixed(2)}</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* 收益区：移动端整行 / PC 端靠右紧凑 */}
                                        <div className="shrink-0 space-y-1.5 md:min-w-[13rem]">
                                            <div className="flex items-center justify-between gap-4 rounded-lg bg-success/10 px-3 py-2">
                                                <span className="text-sm text-success/80">推广赚</span>
                                                {e.currentEarn != null ? (
                                                    <span className="text-lg font-bold text-success tabular-nums">
                                                        ¥{e.currentEarn.toFixed(2)}
                                                        <span className="text-xs font-normal text-success/70">/件</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-lg font-bold text-muted-foreground">—</span>
                                                )}
                                            </div>
                                            {e.topRatePercent != null && e.maxEarn != null && (
                                                <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground md:justify-end">
                                                    <TrendingUp className="size-3.5 shrink-0 text-success" />
                                                    <span>
                                                        冲到顶档 {e.topRatePercent}%，每件最高赚{" "}
                                                        <span className="font-medium text-foreground tabular-nums">¥{e.maxEarn.toFixed(2)}</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* ── 不参与分销 ── */}
            {excluded.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="h-4 w-1 rounded-full bg-muted-foreground/40" />
                        <h2 className="text-sm font-semibold text-muted-foreground">不参与分销</h2>
                        <span className="text-xs text-muted-foreground">{excluded.length} 个</span>
                    </div>
                    <Card className="py-0">
                        <CardContent className="px-4 divide-y divide-border">
                            {excluded.map((row) => (
                                <div
                                    key={row.id}
                                    className="flex items-center justify-between gap-3 py-3 text-sm"
                                >
                                    <span className="min-w-0 flex-1 truncate text-foreground">
                                        {row.name}
                                        <span className="ml-2 text-muted-foreground tabular-nums">¥{row.price.toFixed(2)}</span>
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {row.estimate.note}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </section>
            )}
        </div>
    )
}
