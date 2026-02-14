"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Copy, ExternalLink, Eye } from "lucide-react"

type CardRowActionsProps = {
    content: string
    status: string
    productId: string
}

export function CardRowActions({
    content,
    status,
    productId,
}: CardRowActionsProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // ignore
        }
    }

    return (
        <TooltipProvider delayDuration={0}>
            <div className="flex items-center justify-end gap-1">
                {status === "UNSOLD" && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={handleCopy}
                            >
                                <Copy className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {copied ? "已复制" : "复制卡密"}
                        </TooltipContent>
                    </Tooltip>
                )}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="inline-flex">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                asChild
                            >
                                <Link
                                    href={`/admin/products/${productId}/cards`}
                                    title="前往该商品卡密管理"
                                >
                                    <ExternalLink className="size-4" />
                                </Link>
                            </Button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>前往该商品卡密管理</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="查看完整卡密"
                        >
                            <Eye className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-sm break-all font-mono text-xs">
                        <span className="block text-muted-foreground mb-1">完整卡密</span>
                        {content}
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    )
}
