"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    CreditCard,
    LogOut,
    Store,
    Megaphone,
    Users,
    Layers,
    Wallet,
    BookOpen,
    FolderOpen,
    FlaskConical,
    Mail,
    Landmark,
    ShieldCheck,
    LayoutTemplate,
    Trophy,
    Sparkles,
    Headset,
    BookText,
    UserSearch,
    MessagesSquare,
    Settings,
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
import { useSiteName, useAdminPanelLabel } from "@/app/components/site-name-provider"
import { NotificationBadge } from "@/app/admin/components"
import { usePendingWithdrawals } from "@/app/admin/hooks/use-pending-withdrawals"

const allNavItems = [
    // 总览
    { title: "仪表盘", href: "/admin/dashboard", icon: LayoutDashboard },
    // 商品
    { title: "商品管理", href: "/admin/products", icon: Package },
    { title: "卡密管理", href: "/admin/cards", icon: CreditCard },
    { title: "卡密模版", href: "/admin/card-templates", icon: LayoutTemplate },
    { title: "自动获取验证", href: "/admin/auto-fetch", icon: FlaskConical },
    { title: "系统设置", href: "/admin/settings/site", icon: Settings },
    { title: "联推折扣", href: "/admin/settings/cross-sell", icon: Sparkles },
    // 数据
    { title: "订单管理", href: "/admin/orders", icon: ShoppingCart },
    // 提现
    { title: "提现管理", href: "/admin/withdrawals", icon: Wallet },
    // 公告
    { title: "公告管理", href: "/admin/announcements", icon: Megaphone },
    { title: "分销指南", href: "/admin/guides", icon: BookOpen },
    { title: "邮件营销", href: "/admin/email-marketing", icon: Mail },
    // 运维
    { title: "分销员管理", href: "/admin/distributors", icon: Users },
    { title: "阶梯佣金配置", href: "/admin/commission-tiers", icon: Layers },
    { title: "邀请里程碑奖励", href: "/admin/invitation-milestones", icon: Trophy },
    { title: "收款渠道", href: "/admin/payment-channels", icon: Landmark },
    { title: "文件管理", href: "/admin/files", icon: FolderOpen },
]

const superAdminOnlyItems = [
    { title: "管理员管理", href: "/admin/admins", icon: ShieldCheck },
]

const agentGroup = {
    label: "客服 Agent",
    icon: Headset,
    items: [
        { title: "知识库", href: "/admin/agent/knowledge", icon: BookText },
        { title: "人工跟进", href: "/admin/agent/leads", icon: UserSearch },
        { title: "对话历史", href: "/admin/agent/conversations", icon: MessagesSquare },
    ],
}

interface AdminSidebarProps {
    allowedMenus: string[] | null
    isSuperAdmin: boolean
}

export function AdminSidebar({ allowedMenus, isSuperAdmin }: AdminSidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    useTheme()
    const siteName = useSiteName()
    const adminPanelLabel = useAdminPanelLabel()
    const { count: pendingWithdrawals } = usePendingWithdrawals()

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/admin/login")
                },
            },
        })
    }

    const navItems = [
        ...allNavItems.filter(item => !allowedMenus || allowedMenus.includes(item.href)),
        ...(isSuperAdmin ? superAdminOnlyItems : []),
    ]

    const agentItems = agentGroup.items.filter(
        (item) => !allowedMenus || allowedMenus.includes(item.href),
    )

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/admin/dashboard">
                                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                    <Store className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold">{siteName}</span>
                                    <span className="text-xs text-muted-foreground">{adminPanelLabel}</span>
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
                            {navItems.map((item) => {
                                const isWithdrawals = item.href === "/admin/withdrawals"
                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                                            tooltip={item.title}
                                        >
                                            <Link href={item.href}>
                                                <span className="relative">
                                                    <item.icon className="size-4 shrink-0" />
                                                    {isWithdrawals && (
                                                        <NotificationBadge
                                                            variant="dot"
                                                            count={pendingWithdrawals}
                                                            className="hidden group-data-[collapsible=icon]:inline-flex"
                                                        />
                                                    )}
                                                </span>
                                                <span>{item.title}</span>
                                                {isWithdrawals && (
                                                    <NotificationBadge
                                                        variant="inline"
                                                        count={pendingWithdrawals}
                                                        className="ml-auto group-data-[collapsible=icon]:hidden"
                                                    />
                                                )}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                {agentItems.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel>
                            <agentGroup.icon />
                            <span className="ml-1.5">{agentGroup.label}</span>
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {agentItems.map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                                            tooltip={item.title}
                                        >
                                            <Link href={item.href}>
                                                <item.icon className="size-4 shrink-0" />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="退出登录"
                            onClick={handleSignOut}
                        >
                            <LogOut className="size-4" />
                            <span>退出登录</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
