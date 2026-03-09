"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const routeLabels: Record<string, string> = {
    orders: "我的订单",
    commissions: "我的佣金",
    withdrawals: "提现记录",
}

function getBreadcrumbItems(pathname: string) {
    const segments = pathname.split("/").filter(Boolean)
    const items: { label: string; href?: string }[] = []
    let href = ""

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        if (seg === "distributor") continue
        href += `/${seg}`
        const label = routeLabels[seg] ?? seg
        const isLast = i === segments.length - 1
        items.push(isLast ? { label } : { label, href: `/distributor${href}` })
    }

    return items
}

export function DistributorBreadcrumb() {
    const pathname = usePathname()
    const items = getBreadcrumbItems(pathname)
    const isHome = pathname === "/distributor" || pathname === "/distributor/"

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    {isHome ? (
                        <BreadcrumbPage>仪表盘</BreadcrumbPage>
                    ) : (
                        <BreadcrumbLink asChild>
                            <Link href="/distributor">仪表盘</Link>
                        </BreadcrumbLink>
                    )}
                </BreadcrumbItem>
                {items.map((item, idx) => (
                    <span key={`${item.href ?? "current"}-${idx}`} className="flex items-center gap-1.5">
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            {item.href ? (
                                <BreadcrumbLink asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage>{item.label}</BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                    </span>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )
}

