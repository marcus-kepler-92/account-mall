"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAdminPanelLabel } from "@/app/components/site-name-provider"
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
    orders: "订单管理",
    cards: "卡密管理",
    "card-templates": "卡密模版",
    announcements: "公告管理",
    guides: "分销指南",
    distributors: "分销商",
    "commission-tiers": "佣金档位",
    "invitation-milestones": "邀请里程碑奖励",
    withdrawals: "提现",
    files: "文件管理",
    "auto-fetch": "自动获取验证",
    "email-marketing": "邮件营销",
    templates: "邮件模板",
    campaigns: "群发活动",
    "payment-channels": "收款渠道",
    admins: "管理员管理",
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
        if (prev === "products") {
            if (seg === "cards") {
                label = "卡密"
            } else if (seg === "new") {
                label = "新建商品"
            } else if (isIdSegment(seg)) {
                label = "商品详情"
            } else {
                label = routeLabels[seg] ?? seg
            }
        } else if (prev === "orders" && isIdSegment(seg)) {
            label = "订单详情"
        } else if (prev === "announcements") {
            if (seg === "new") {
                label = "新建公告"
            } else if (isIdSegment(seg)) {
                label = "公告详情"
            } else {
                label = routeLabels[seg] ?? seg
            }
        } else if (prev === "guides") {
            if (seg === "new") {
                label = "新建指南"
            } else if (isIdSegment(seg)) {
                label = "编辑指南"
            } else {
                label = routeLabels[seg] ?? seg
            }
        } else if (prev === "templates") {
            if (seg === "new") {
                label = "新建模板"
            } else if (isIdSegment(seg)) {
                label = "模板详情"
            } else {
                label = routeLabels[seg] ?? seg
            }
        } else if (prev && isIdSegment(prev) && seg === "edit") {
            label = "编辑模板"
        } else if (prev === "payment-channels") {
            if (isIdSegment(seg)) {
                label = "渠道详情"
            } else {
                label = routeLabels[seg] ?? seg
            }
        } else if (prev === "campaigns") {
            if (seg === "new") {
                label = "新建活动"
            } else if (isIdSegment(seg)) {
                label = "活动详情"
            } else {
                label = routeLabels[seg] ?? seg
            }
        } else if (seg in routeLabels) {
            label = routeLabels[seg]
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
    const adminPanelLabel = useAdminPanelLabel()
    const items = getBreadcrumbItems(pathname)

    if (items.length === 0) return null

    return (
        <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem className="hidden sm:list-item">
                    <BreadcrumbLink asChild>
                        <Link href="/admin/dashboard">{adminPanelLabel}</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {items.map((item, idx) => {
                    const isLast = idx === items.length - 1
                    return (
                        <span
                            key={`${item.href ?? "current"}-${idx}`}
                            className={`flex items-center gap-1.5${isLast ? "" : " hidden sm:flex"}`}
                        >
                            <BreadcrumbSeparator className={isLast ? "hidden sm:block" : undefined} />
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
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
