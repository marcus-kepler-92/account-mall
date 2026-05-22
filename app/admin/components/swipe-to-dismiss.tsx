"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion"
import { cn } from "@/lib/utils"

const THRESHOLD_PX = 80
const FLY_OUT_PX = 420

/** Horizontal swipe-to-dismiss for a single row. Drag past 80px to mark this item as read. */
export function SwipeToDismiss({
    children,
    onDismiss,
    className,
}: {
    children: ReactNode
    onDismiss: () => void
    className?: string
}) {
    const [dismissed, setDismissed] = useState(false)
    const x = useMotionValue(0)
    const opacity = useTransform(
        x,
        [-THRESHOLD_PX * 1.6, -THRESHOLD_PX, 0, THRESHOLD_PX, THRESHOLD_PX * 1.6],
        [0, 0.5, 1, 0.5, 0],
    )
    const background = useTransform(x, (v) => {
        const intensity = Math.min(1, Math.abs(v) / THRESHOLD_PX)
        return intensity > 0 ? `rgba(239, 68, 68, ${intensity * 0.18})` : "transparent"
    })

    const onDragEnd = (_e: unknown, info: PanInfo) => {
        const dx = info.offset.x
        if (Math.abs(dx) > THRESHOLD_PX) {
            setDismissed(true)
            x.set(dx > 0 ? FLY_OUT_PX : -FLY_OUT_PX)
        }
    }

    return (
        <motion.div
            drag="x"
            dragMomentum={false}
            dragElastic={0.6}
            dragSnapToOrigin={!dismissed}
            onDragEnd={onDragEnd}
            onAnimationComplete={() => {
                if (dismissed) onDismiss()
            }}
            style={{ x, opacity, background, touchAction: "pan-y" }}
            className={cn(
                "relative -mx-2 px-2 cursor-grab active:cursor-grabbing select-none rounded-sm",
                className,
            )}
        >
            {children}
        </motion.div>
    )
}
