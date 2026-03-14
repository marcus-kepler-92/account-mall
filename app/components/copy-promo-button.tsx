"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CopyButtonClientProps {
    text: string
    label?: string
    copiedLabel?: string
    successMessage?: string
    size?: "sm" | "icon" | "default"
    variant?: "secondary" | "ghost" | "outline"
    className?: string
}

export function CopyButtonClient({
    text,
    label = "复制链接",
    copiedLabel = "已复制",
    successMessage = "已复制到剪贴板",
    size = "sm",
    variant = "secondary",
    className,
}: CopyButtonClientProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            toast.success(successMessage)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("复制失败")
        }
    }

    const Icon = copied ? Check : Copy

    return (
        <Button size={size} variant={variant} className={cn("shrink-0", className)} onClick={handleCopy}>
            <Icon className={cn("size-4", size !== "icon" && "mr-1")} />
            {size !== "icon" && (copied ? copiedLabel : label)}
        </Button>
    )
}
