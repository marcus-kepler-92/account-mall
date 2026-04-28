"use client"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

interface TopbarUserMenuProps {
    initial: string
    displayName: string
    subLabel?: string
    children?: React.ReactNode
    onSignOut: () => Promise<void>
}

export function TopbarUserMenu({
    initial,
    displayName,
    subLabel,
    children,
    onSignOut,
}: TopbarUserMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {/* suppressHydrationWarning: radix-ui 1.4.x + React 19 known useId() mismatch */}
                <Button suppressHydrationWarning variant="ghost" size="icon" className="relative min-w-9 rounded-full touch-manipulation">
                    <Avatar className="size-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            {initial}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-3">
                        <Avatar className="size-9 shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                                {initial}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                            <p className="text-sm font-semibold truncate">{displayName}</p>
                            {subLabel && (
                                <p className="text-xs text-muted-foreground truncate">{subLabel}</p>
                            )}
                        </div>
                    </div>
                </DropdownMenuLabel>
                {children && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 space-y-1.5">
                            {children}
                        </div>
                    </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                    <LogOut className="size-4" />
                    退出登录
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
