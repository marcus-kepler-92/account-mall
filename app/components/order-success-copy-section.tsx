"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"

type OrderSuccessCopySectionProps = {
    cards: string[]
}

export function OrderSuccessCopySection({ cards }: OrderSuccessCopySectionProps) {
    const [copiedAll, setCopiedAll] = useState(false)
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

    const copyAll = async () => {
        if (cards.length === 0) return
        const text = cards.join("\n")
        try {
            await navigator.clipboard.writeText(text)
            setCopiedAll(true)
            toast.success(`已复制 ${cards.length} 条卡密`)
            setTimeout(() => setCopiedAll(false), 2000)
        } catch {
            toast.error("复制失败，请手动复制")
        }
    }

    const copyOne = async (content: string, index: number) => {
        try {
            await navigator.clipboard.writeText(content)
            setCopiedIndex(index)
            toast.success("已复制")
            setTimeout(() => setCopiedIndex(null), 2000)
        } catch {
            toast.error("复制失败")
        }
    }

    if (cards.length === 0) {
        return <p className="text-sm text-muted-foreground">暂无卡密数据</p>
    }

    return (
        <div className="space-y-3">
            <Button
                type="button"
                variant="secondary"
                className="w-full gap-2"
                onClick={copyAll}
            >
                {copiedAll ? (
                    <Check className="size-4" />
                ) : (
                    <Copy className="size-4" />
                )}
                一键复制全部卡密（{cards.length} 条）
            </Button>
            <ul className="space-y-2">
                {cards.map((content, i) => (
                    <li
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 font-mono text-sm"
                    >
                        <span className="min-w-0 flex-1 truncate">{content}</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => copyOne(content, i)}
                        >
                            {copiedIndex === i ? (
                                <Check className="size-4 text-green-600" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
