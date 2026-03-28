"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Headset, Send, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import { configClient } from "@/lib/config-client"

const BTN = 48 // button size px
const DRAG_THRESHOLD = 4 // px moved before treating as drag

function getInitialPos(): { x: number; y: number } {
    return {
        x: window.innerWidth - BTN - 16,
        y: window.innerHeight - BTN - (window.innerWidth >= 1024 ? 24 : 112),
    }
}

function normalizeTgUrl(value: string): string {
    if (!value) return ""
    if (value.startsWith("http://") || value.startsWith("https://")) return value
    return `https://t.me/${value.replace(/^@/, "")}`
}

export function CustomerServiceFab() {
    const pathname = usePathname()
    const telegram = configClient.supportTelegram
    const wechat = configClient.supportWechat

    const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
    const [pulsing, setPulsing] = useState(true)
    const [open, setOpen] = useState(false)
    const [copied, setCopied] = useState(false)

    const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0, moved: false })

    // Initialize position client-side only (deferred to avoid SSR mismatch)
    useEffect(() => {
        const t = setTimeout(() => setPulsing(false), 3000)
        return () => clearTimeout(t)
    }, [])

    useEffect(() => {
        const raf = requestAnimationFrame(() => setPos(getInitialPos()))
        return () => cancelAnimationFrame(raf)
    }, [])

    // Clamp on resize
    useEffect(() => {
        const onResize = () => {
            setPos((p) => {
                if (!p) return p
                return {
                    x: Math.min(Math.max(0, p.x), window.innerWidth - BTN),
                    y: Math.min(Math.max(0, p.y), window.innerHeight - BTN),
                }
            })
        }
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return
        dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, originX: pos?.x ?? 0, originY: pos?.y ?? 0, moved: false }
        e.currentTarget.setPointerCapture(e.pointerId)
    }, [pos])

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const d = dragRef.current
        if (!d.active) return
        const dx = e.clientX - d.startX
        const dy = e.clientY - d.startY
        if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        d.moved = true
        setOpen(false)
        setPos({
            x: Math.min(Math.max(0, d.originX + dx), window.innerWidth - BTN),
            y: Math.min(Math.max(0, d.originY + dy), window.innerHeight - BTN),
        })
    }, [])

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const d = dragRef.current
        if (!d.active) return
        d.active = false
        e.currentTarget.releasePointerCapture(e.pointerId)
        // d.moved: drag ended; click event won't fire because pointer was captured
    }, [])

    // Prevent click from opening popover after a drag
    const onClickCapture = useCallback((e: React.MouseEvent) => {
        if (dragRef.current.moved) {
            e.stopPropagation()
            dragRef.current.moved = false
        }
    }, [])

    const handleTelegram = () => {
        window.open(normalizeTgUrl(telegram), "_blank", "noopener,noreferrer")
    }

    const handleCopyWechat = async () => {
        try {
            await navigator.clipboard.writeText(wechat)
            setCopied(true)
            toast.success("微信号已复制")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("复制失败，请手动复制：" + wechat)
        }
    }

    if (pathname.startsWith("/admin") || pathname.startsWith("/distributor")) return null
    if (!telegram && !wechat) return null
    // Hide until position is initialized (avoids SSR position flash)
    if (!pos) return null

    const btnClass = `touch-none select-none flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg cursor-grab active:cursor-grabbing hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${pulsing ? "animate-pulse" : ""}`

    const sharedPointerProps = {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onClickCapture,
        style: { position: "fixed" as const, left: pos.x, top: pos.y, zIndex: 50 },
    }

    // TG only — no popover
    if (telegram && !wechat) {
        return (
            <button
                aria-label="联系 Telegram 客服"
                className={btnClass}
                onClick={handleTelegram}
                {...sharedPointerProps}
            >
                <Headset className="size-5" />
            </button>
        )
    }

    const popoverContent = wechat && !telegram ? (
        <PopoverContent side="top" align="end" className="w-52 p-3">
            <p className="mb-2 text-xs text-muted-foreground">微信号</p>
            <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-sm font-mono">{wechat}</code>
                <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={handleCopyWechat}>
                    {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                </Button>
            </div>
        </PopoverContent>
    ) : (
        <PopoverContent side="top" align="end" className="w-52 p-2">
            <Button variant="ghost" className="w-full justify-start gap-2 text-sm" onClick={handleTelegram}>
                <Send className="size-4" />
                Telegram 客服
            </Button>
            <div className="px-3 py-2">
                <p className="mb-1 text-xs text-muted-foreground">微信号</p>
                <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-sm font-mono">{wechat}</code>
                    <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={handleCopyWechat}>
                        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                    </Button>
                </div>
            </div>
        </PopoverContent>
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    aria-label="联系客服"
                    className={btnClass}
                    {...sharedPointerProps}
                >
                    <Headset className="size-5" />
                </button>
            </PopoverTrigger>
            {popoverContent}
        </Popover>
    )
}
