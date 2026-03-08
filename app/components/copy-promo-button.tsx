"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"

export function CopyButtonClient({ url }: { url: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            toast.success("推广链接已复制到剪贴板")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("复制失败")
        }
    }

    return (
        <Button size="sm" variant="secondary" className="shrink-0" onClick={handleCopy}>
            <Copy className="size-4 mr-1" />
            {copied ? "已复制" : "复制链接"}
        </Button>
    )
}
