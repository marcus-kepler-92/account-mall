"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Headset } from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { useKeyboardInset } from "@/hooks/use-keyboard-inset"
import { ChatPanel } from "./agent-chat/chat-panel"
import { ChatPanelErrorBoundary } from "./agent-chat/error-boundary"

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
    const isMobile = useIsMobile()

    const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
    const [pulsing, setPulsing] = useState(true)
    const [open, setOpen] = useState(false)

    const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0, moved: false })

    useEffect(() => {
        const t = setTimeout(() => setPulsing(false), 3000)
        return () => clearTimeout(t)
    }, [])

    // External "open customer service" entry. Any surface (e.g. MANUAL
    // sold-out sticky bar, unavailable-product placeholder) can dispatch
    // `open-customer-service` to programmatically pop the FAB without
    // duplicating the popover/sheet logic.
    useEffect(() => {
        const handler = () => setOpen(true)
        document.addEventListener("open-customer-service", handler)
        return () => document.removeEventListener("open-customer-service", handler)
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

    const fabButton = (
        <button
            aria-label="联系客服"
            className={btnClass}
            {...sharedPointerProps}
        >
            <Headset className="size-5" />
        </button>
    )

    // 仅渲染一种 trigger; 双渲染会导致 Sheet + Popover 同时监听 open 互相打架.
    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>{fabButton}</SheetTrigger>
                <MobileSheetContent />
            </Sheet>
        )
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{fabButton}</PopoverTrigger>
            <PopoverContent
                side="top"
                align="end"
                sideOffset={8}
                collisionPadding={8}
                className="h-[600px] w-[380px] p-0"
            >
                <ChatPanelErrorBoundary>
                    <ChatPanel />
                </ChatPanelErrorBoundary>
            </PopoverContent>
        </Popover>
    )
}

// Mobile bottom sheet container. iOS Safari's soft keyboard does not
// shrink `100dvh`, so a naive `h-[100dvh]` Sheet places the composer
// directly under the keyboard. We listen to visualViewport via
// useKeyboardInset and pad the bottom of the sheet's content by the
// keyboard's overlay height so the composer floats just above it.
//
// Split into its own component so the hook only runs while the sheet
// is mounted (Radix unmounts SheetContent on close).
function MobileSheetContent() {
    const keyboardInset = useKeyboardInset()
    return (
        <SheetContent
            side="bottom"
            className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0"
            style={
                keyboardInset > 0
                    ? { paddingBottom: `${keyboardInset}px` }
                    : undefined
            }
        >
            <SheetHeader className="border-b p-3 text-left">
                <SheetTitle className="text-base">AI 客服</SheetTitle>
                <SheetDescription className="sr-only">
                    与 AI 客服对话, 解答商品 / 订单 / 平台规则相关咨询
                </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1">
                <ChatPanelErrorBoundary>
                    <ChatPanel />
                </ChatPanelErrorBoundary>
            </div>
        </SheetContent>
    )
}
