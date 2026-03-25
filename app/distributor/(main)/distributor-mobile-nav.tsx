"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { navItems } from "@/app/components/distributor-sidebar"
import { cn } from "@/lib/utils"

// "入门手册" is accessible from the dashboard page; hide it from the mobile tab bar
// to keep the bottom bar to 5 items max for comfortable thumb reach
const MOBILE_HIDDEN_TABS = new Set(["/distributor/guide"])

const shortLabels: Record<string, string> = {
    "我的团队": "团队",
    "我的订单": "订单",
    "我的奖金": "奖金",
    "提现记录": "提现",
}

export function DistributorMobileNav() {
    const pathname = usePathname()
    const mobileNavItems = navItems.filter((item) => !MOBILE_HIDDEN_TABS.has(item.href))

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t bg-background md:hidden supports-[padding-bottom:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]"
            aria-label="分销中心导航"
        >
            {mobileNavItems.map((item) => {
                const isActive =
                    item.href === "/distributor"
                        ? pathname === "/distributor"
                        : pathname.startsWith(item.href)
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-label={item.title}
                        className={cn(
                            "flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors touch-manipulation",
                            isActive && "text-primary"
                        )}
                    >
                        <item.icon className={cn("size-5", isActive && "stroke-[2.5]")} />
                        <span className="text-[10px] leading-tight font-medium">
                            {shortLabels[item.title] ?? item.title}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
