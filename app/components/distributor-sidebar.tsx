"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    ShoppingCart,
    Coins,
    Wallet,
    LogOut,
    Store,
    BookOpen,
} from "lucide-react"
import { useTheme } from "next-themes"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"
import { useSiteName } from "@/app/components/site-name-provider"

const navItems = [
    { title: "仪表盘", href: "/distributor", icon: LayoutDashboard },
    { title: "入门手册", href: "/distributor/guide", icon: BookOpen },
    { title: "我的订单", href: "/distributor/orders", icon: ShoppingCart },
    { title: "我的佣金", href: "/distributor/commissions", icon: Coins },
    { title: "提现记录", href: "/distributor/withdrawals", icon: Wallet },
]

export function DistributorSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    useTheme()
    const siteName = useSiteName()

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
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/distributor">
                                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                    <Store className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold">{siteName}</span>
                                    <span className="text-xs text-muted-foreground">分销中心</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>导航</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={
                                            item.href === "/distributor"
                                                ? pathname === "/distributor"
                                                : pathname.startsWith(item.href)
                                        }
                                        tooltip={item.title}
                                    >
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="退出登录"
                            onClick={handleSignOut}
                        >
                            <LogOut />
                            <span>退出登录</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
