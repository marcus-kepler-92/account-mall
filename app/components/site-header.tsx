"use client"

import Link from "next/link"
import { Zap, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/app/components/theme-toggle"
import { MyOrderHistory } from "@/app/components/my-order-history"
import { useSiteName } from "@/app/components/site-name-provider"

export function SiteHeader() {
    const siteName = useSiteName()
    return (
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm supports-[padding:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top)]">
            <div className="mx-auto flex h-14 min-h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:px-4 md:px-6 2xl:max-w-7xl">
                <Link
                    href="/"
                    className="flex min-w-0 shrink items-center gap-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                        <Zap className="size-4 text-primary-foreground" />
                    </div>
                    <span className="truncate text-base font-bold tracking-tight sm:text-lg">
                        {siteName}
                    </span>
                </Link>
                <nav className="flex shrink-0 items-center gap-0.5 sm:gap-2" aria-label="主导航">
                    <MyOrderHistory />
                    <ThemeToggle />
                    <Button variant="ghost" size="sm" className="size-9 shrink-0 p-0 sm:size-auto sm:px-3" asChild>
                        <Link
                        href="/orders/lookup"
                        title="订单查询"
                        aria-label="订单查询"
                        className="gap-1.5 sm:gap-2"
                    >
                            <Search className="size-4 shrink-0" aria-hidden />
                            <span className="hidden sm:inline">订单查询</span>
                        </Link>
                    </Button>
                </nav>
            </div>
        </header>
    )
}
