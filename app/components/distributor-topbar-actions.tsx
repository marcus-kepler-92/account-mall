"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { ThemeToggle } from "@/app/components/theme-toggle"
import { TopbarUserMenu } from "@/app/components/topbar-user-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"

interface DistributorTopbarActionsProps {
    name: string
    email: string
    username: string
    distributorCode: string
}

export function DistributorTopbarActions({
    name,
    email,
    username,
    distributorCode,
}: DistributorTopbarActionsProps) {
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

    const displayName = name || username || email || "分销员"
    const subLabel = name ? (email || username || undefined) : (email || username || undefined)
    const initial = displayName[0].toUpperCase()

    return (
        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="size-9 min-w-9 touch-manipulation" asChild aria-label="前往商城">
                <Link href="/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                </Link>
            </Button>
            <TopbarUserMenu
                initial={initial}
                displayName={displayName}
                subLabel={subLabel}
                onSignOut={handleSignOut}
            >
                {distributorCode && (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">邀请码</span>
                        <span className="font-mono font-medium">{distributorCode}</span>
                    </div>
                )}
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">身份</span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">分销员</Badge>
                </div>
            </TopbarUserMenu>
        </div>
    )
}
