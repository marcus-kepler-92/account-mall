"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { ThemeToggle } from "@/app/components/theme-toggle"
import { TopbarUserMenu } from "@/app/components/topbar-user-menu"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export function AdminTopbarActions() {
    const router = useRouter()
    const { data: session } = authClient.useSession()

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/admin/login")
                },
            },
        })
    }

    const email = session?.user?.email ?? ""
    const name = session?.user?.name ?? ""
    const displayName = name || email || "管理员"
    const initial = displayName[0].toUpperCase()

    return (
        <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild aria-label="前往商城">
                <Link href="/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                </Link>
            </Button>
            <TopbarUserMenu
                initial={initial}
                displayName={displayName}
                subLabel={name ? email : undefined}
                onSignOut={handleSignOut}
            />
        </div>
    )
}
