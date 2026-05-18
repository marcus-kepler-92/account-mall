"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Headset } from "lucide-react"
import Image from "next/image"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { CopyButtonClient } from "@/app/components/copy-promo-button"

const WECHAT_ID = "void_mall"

const BTN = 48 // button size px
const DRAG_THRESHOLD = 4 // px moved before treating as drag

function getInitialPos(): { x: number; y: number } {
    return {
        x: window.innerWidth - BTN - 16,
        y: window.innerHeight - BTN - (window.innerWidth >= 1024 ? 24 : 112),
    }
}

export function CustomerServiceFab() {
    const pathname = usePathname()
    const wechat = true // QR code always shown

    const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
    const [pulsing, setPulsing] = useState(true)
    const [open, setOpen] = useState(false)

    const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0, moved: false })

    useEffect(() => {
        const t = setTimeout(() => setPulsing(false), 3000)
        return () => clearTimeout(t)
    }, [])

    useEffect(() => {
        const raf = requestAnimationFrame(() => setPos(getInitialPos()))
        return () => cancelAnimationFrame(raf)
    }, [])

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
    }, [])

    const onClickCapture = useCallback((e: React.MouseEvent) => {
        if (dragRef.current.moved) {
            e.stopPropagation()
            dragRef.current.moved = false
        }
    }, [])

    if (pathname.startsWith("/admin") || pathname.startsWith("/distributor")) return null
    if (!wechat) return null
    if (!pos) return null

    const btnClass = `touch-none select-none flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg cursor-grab active:cursor-grabbing hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${pulsing ? "animate-pulse" : ""}`

    const sharedPointerProps = {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onClickCapture,
        style: { position: "fixed" as const, left: pos.x, top: pos.y, zIndex: 50 },
    }

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
            <PopoverContent side="top" align="end" className="w-48 p-3">
                <p className="mb-2 text-center text-xs text-muted-foreground">扫码联系客服</p>
                <Image
                    src="/contact-qr.png"
                    alt="客服二维码"
                    width={168}
                    height={168}
                    className="rounded"
                />
                <p className="mt-3 text-center text-[11px] leading-snug text-muted-foreground">
                    紧急情况可加微信
                </p>
                <div className="mt-1 flex items-center justify-between gap-2 rounded border bg-muted/40 px-2 py-1.5">
                    <span className="truncate text-xs">
                        <span className="text-muted-foreground">微信：</span>
                        <span className="font-mono">{WECHAT_ID}</span>
                    </span>
                    <CopyButtonClient
                        text={WECHAT_ID}
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        successMessage="微信号已复制"
                    />
                </div>
            </PopoverContent>
        </Popover>
    )
}
