"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Store } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { navItems } from "@/app/components/distributor-sidebar"
import { cn } from "@/lib/utils"

const shortLabels: Record<string, string> = {
    "仪表盘": "总览",
    "入门手册": "手册",
    "我的团队": "团队",
    "我的订单": "订单",
    "我的奖金": "奖金",
    "提现记录": "提现",
}

export function DistributorMobileNav() {
    const pathname = usePathname()
    const router = useRouter()

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/distributor/login")
                },
            },
        })
    }

    return (
        <nav
            className="fixed inset-y-0 left-0 z-40 flex w-14 flex-col items-center border-r bg-background pt-2 pb-4 md:hidden supports-[padding:env(safe-area-inset-left)]:pl-[env(safe-area-inset-left)]"
            aria-label="分销中心导航"
        >
            <Link
                href="/distributor"
                className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary"
                aria-label="分销中心首页"
            >
                <Store className="size-4 text-primary-foreground" />
            </Link>

            <div className="flex flex-1 flex-col items-center gap-1">
                {navItems.map((item) => {
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
                                "flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground transition-colors touch-manipulation",
                                isActive && "bg-accent text-accent-foreground"
                            )}
                        >
                            <item.icon className="size-5" />
                            <span className="text-[10px] leading-tight">
                                {shortLabels[item.title] ?? item.title}
                            </span>
                        </Link>
                    )
                })}
            </div>

            <button
                onClick={handleSignOut}
                aria-label="退出登录"
                className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground touch-manipulation"
            >
                <LogOut className="size-5" />
                <span className="text-[10px] leading-tight">退出</span>
            </button>
        </nav>
    )
}
