"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"

const navItems = [
    { href: "/distributor", label: "分销中心" },
    { href: "/distributor/orders", label: "我的订单" },
    { href: "/distributor/commissions", label: "我的佣金" },
    { href: "/distributor/withdrawals", label: "提现记录" },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname()
    return (
        <>
            {navItems.map((item) => {
                const isActive =
                    item.href === "/distributor"
                        ? pathname === "/distributor"
                        : pathname.startsWith(item.href)
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`block rounded-lg px-3 py-2.5 text-sm transition-colors touch-manipulation ${
                            isActive
                                ? "font-medium bg-muted text-foreground"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                    >
                        {item.label}
                    </Link>
                )
            })}
        </>
    )
}

export function DistributorNav() {
    const [open, setOpen] = useState(false)

    return (
        <>
            {/* 移动端：受控 Sheet，用 Button 打开，避免 SheetTrigger 带来的 Radix aria-controls hydration mismatch */}
            <Sheet open={open} onOpenChange={setOpen}>
                <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="lg:hidden size-9 min-w-9 shrink-0 touch-manipulation"
                    aria-label="打开菜单"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    onClick={() => setOpen(true)}
                >
                    <Menu className="size-5" />
                </Button>
                <SheetContent
                    side="left"
                    className="w-[min(85vw,20rem)] pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pr-12"
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>导航</SheetTitle>
                    </SheetHeader>
                    <nav className="flex flex-col gap-1 pt-12" aria-label="主导航">
                        <NavLinks onNavigate={() => setOpen(false)} />
                    </nav>
                </SheetContent>
            </Sheet>
            {/* 桌面端：横向链接 */}
            <nav className="hidden lg:flex items-center gap-6" aria-label="主导航">
                <NavLinks />
            </nav>
        </>
    )
}
