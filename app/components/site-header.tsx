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
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 2xl:max-w-7xl">
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                        <Zap className="size-4 text-primary-foreground" />
                    </div>
                    <span className="text-lg font-bold tracking-tight">{siteName}</span>
                </Link>
                <nav className="flex items-center gap-2">
                    <MyOrderHistory />
                    <ThemeToggle />
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/orders/lookup">
                            <Search className="size-4" />
                            订单查询
                        </Link>
                    </Button>
                </nav>
            </div>
        </header>
    )
}
