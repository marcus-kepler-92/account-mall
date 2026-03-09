"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, ExternalLink } from "lucide-react"

export function DistributorTopbarActions() {
    const router = useRouter()
    const { data: session } = authClient.useSession()

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/distributor/login")
                },
            },
        })
    }

    const email = session?.user?.email ?? ""
    const initial = email ? email[0].toUpperCase() : "D"

    return (
        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="size-9 min-w-9 touch-manipulation" asChild aria-label="前往商城">
                <Link href="/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                </Link>
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative size-9 min-w-9 rounded-full touch-manipulation">
                        <Avatar className="size-8">
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                                {initial}
                            </AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium">分销员</p>
                            <p className="text-xs text-muted-foreground truncate">
                                {email || "—"}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="size-4" />
                        退出登录
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
