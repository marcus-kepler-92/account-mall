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
    dashboard: "仪表盘",
    products: "商品管理",
    new: "新建商品",
    orders: "订单管理",
    cards: "卡密管理",
}

function isIdSegment(seg: string) {
    return seg.length >= 20 && /^[a-z0-9]+$/i.test(seg)
}

function getBreadcrumbItems(pathname: string) {
    const segments = pathname.split("/").filter(Boolean)
    const items: { label: string; href?: string }[] = []
    let href = ""

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const prev = segments[i - 1]
        href += `/${seg}`

        if (seg === "admin") continue

        let label: string
        if (seg in routeLabels) {
            label = routeLabels[seg]
        } else if (prev === "products") {
            if (seg === "cards") {
                label = "卡密"
            } else if (isIdSegment(seg)) {
                label = "商品详情"
            } else {
                label = seg
            }
        } else if (prev === "orders" && isIdSegment(seg)) {
            label = "订单详情"
        } else {
            label = seg
        }

        const isLast = i === segments.length - 1
        items.push(isLast ? { label } : { label, href })
    }

    return items
}

export function AdminBreadcrumb() {
    const pathname = usePathname()
    const items = getBreadcrumbItems(pathname)

    if (items.length === 0) return null

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href="/admin/dashboard">管理后台</Link>
                    </BreadcrumbLink>
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
