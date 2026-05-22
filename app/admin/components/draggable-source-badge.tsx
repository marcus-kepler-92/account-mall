"use client"

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react"
import { cn } from "@/lib/utils"
import {
    useDismissAdminNotifications,
    type DismissItem,
} from "@/app/admin/hooks/use-admin-notifications"

const DRAG_THRESHOLD = 40
const FLY_OUT_MS = 200

type Variant = "inline" | "dot"
type Phase = "idle" | "dragging" | "leaving"

type Props = {
    count: number
    variant: Variant
    items: DismissItem[]
    className?: string
}

const TRANSITION: Record<Phase, string> = {
    idle: "transform 160ms ease-out, opacity 160ms ease-out",
    dragging: "transform 30ms linear",
    leaving: `transform ${FLY_OUT_MS}ms ease-out, opacity ${FLY_OUT_MS}ms ease-out`,
}

/**
 * Source-level draggable badge. While dragging, the visual is portalled onto document.body so
 * it can escape the sidebar's overflow/clipping. The placeholder stays in flow and keeps
 * receiving pointer events via setPointerCapture.
 */
export function DraggableSourceBadge({ count, variant, items, className }: Props) {
    const dismiss = useDismissAdminNotifications()
    const [phase, setPhase] = useState<Phase>("idle")
    const [delta, setDelta] = useState({ x: 0, y: 0 })
    const [origin, setOrigin] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
    const startRef = useRef({ x: 0, y: 0 })
    const deltaRef = useRef({ x: 0, y: 0 })

    if (count <= 0) return null

    const display = count > 99 ? "99+" : String(count)

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (phase === "leaving") return
        if (e.pointerType === "mouse" && e.button !== 0) return
        const el = e.currentTarget as HTMLDivElement
        const rect = el.getBoundingClientRect()
        startRef.current = { x: e.clientX, y: e.clientY }
        deltaRef.current = { x: 0, y: 0 }
        setOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
        setPhase("dragging")
        setDelta({ x: 0, y: 0 })
        el.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (phase !== "dragging") return
        const d = { x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y }
        deltaRef.current = d
        setDelta(d)
    }

    const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        const el = e.currentTarget as HTMLDivElement
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
        if (phase !== "dragging") return

        const d = deltaRef.current
        const dist = Math.hypot(d.x, d.y)
        if (dist > DRAG_THRESHOLD && items.length > 0) {
            const norm = dist > 0 ? { x: d.x / dist, y: d.y / dist } : { x: 1, y: 0 }
            // Aim further out than the release point so the badge always flies away, never back.
            const flyDist = Math.max(dist + 200, 320)
            setPhase("leaving")
            setDelta({ x: norm.x * flyDist, y: norm.y * flyDist })
            dismiss.mutate(items)
        } else {
            setPhase("idle")
            setDelta({ x: 0, y: 0 })
            setOrigin(null)
        }
    }

    const isActive = phase !== "idle"
    const intensity = Math.min(1, Math.hypot(delta.x, delta.y) / DRAG_THRESHOLD)
    const scale = phase === "dragging" ? 1 + 0.15 * intensity : phase === "leaving" ? 0 : 1
    const opacity = phase === "leaving" ? 0 : isActive ? Math.max(0.5, 1 - intensity * 0.3) : 1

    const placeholderStyle: CSSProperties = {
        touchAction: "none",
        cursor: phase === "dragging" ? "grabbing" : "grab",
        userSelect: "none",
        WebkitUserSelect: "none",
        opacity: isActive ? 0 : 1,
    }

    const portalStyle: CSSProperties | null = origin
        ? {
              position: "fixed",
              left: origin.left,
              top: origin.top,
              width: origin.width,
              height: origin.height,
              transform: `translate(${delta.x}px, ${delta.y}px) scale(${scale})`,
              opacity,
              transition: TRANSITION[phase],
              zIndex: 9999,
              pointerEvents: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
          }
        : null

    const baseClass = variant === "inline"
        ? "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-white tabular-nums"
        : "inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-none text-white ring-2 ring-background"

    return (
        <>
            <div
                role="status"
                aria-label={`${display} 项待处理，拖走可全部标记为已读`}
                title="拖走可标记本组全部已读"
                style={placeholderStyle}
                className={cn(baseClass, className)}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onClick={(e) => e.stopPropagation()}
                onDragStartCapture={(e) => e.preventDefault()}
            >
                {display}
            </div>
            {isActive && portalStyle && typeof document !== "undefined"
                ? createPortal(
                      <div aria-hidden style={portalStyle} className={cn(baseClass)}>
                          {display}
                      </div>,
                      document.body,
                  )
                : null}
        </>
    )
}
