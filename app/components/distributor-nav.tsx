"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
    { href: "/distributor", label: "分销中心" },
    { href: "/distributor/orders", label: "我的订单" },
    { href: "/distributor/commissions", label: "我的佣金" },
    { href: "/distributor/withdrawals", label: "提现记录" },
]

export function DistributorNav() {
    const pathname = usePathname()

    return (
        <nav className="flex items-center gap-6">
            {navItems.map((item) => {
                const isActive =
                    item.href === "/distributor"
                        ? pathname === "/distributor"
                        : pathname.startsWith(item.href)
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`text-sm transition-colors ${
                            isActive
                                ? "font-medium text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {item.label}
                    </Link>
                )
            })}
        </nav>
    )
}
