"use client"

import Image from "next/image"
import { useState } from "react"
import { Loader2, QrCode, ImageOff } from "lucide-react"

type Props = {
    // URL from SiteSetting DB row via /api/agent/session/start. Empty
    // string means the admin hasn't configured the QR yet — we degrade
    // to a static QrCode placeholder rather than 404-ing next/image.
    src: string
    alt?: string
}

// Three runtime states layered on the 168×168 frame so the surrounding
// layout never reflows:
//   1. src === ""        → "暂未配置" placeholder (admin hasn't set it)
//   2. src present, loading → spinner overlay on a muted square
//   3. src present, error   → "加载失败" placeholder
// Without this, slow networks left users staring at empty whitespace
// thinking no QR was rendered.
export function QrImage({ src, alt = "客服二维码" }: Props) {
    const [status, setStatus] = useState<"loading" | "loaded" | "error">(
        "loading",
    )

    if (!src) {
        return (
            <div className="flex h-[168px] w-[168px] flex-col items-center justify-center gap-1 rounded border bg-muted text-muted-foreground">
                <QrCode className="size-12" />
                <span className="text-xs">客服二维码暂未配置</span>
            </div>
        )
    }

    if (status === "error") {
        return (
            <div className="flex h-[168px] w-[168px] flex-col items-center justify-center gap-1 rounded border bg-muted text-muted-foreground">
                <ImageOff className="size-12" />
                <span className="text-xs">二维码加载失败，请稍后再试</span>
            </div>
        )
    }

    return (
        <div className="relative h-[168px] w-[168px]">
            {status === "loading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded border bg-muted text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                    <span className="text-xs">二维码加载中…</span>
                </div>
            )}
            <Image
                src={src}
                alt={alt}
                width={168}
                height={168}
                unoptimized
                onLoad={() => setStatus("loaded")}
                onError={() => setStatus("error")}
                className={`h-auto w-[168px] rounded transition-opacity duration-200 ${
                    status === "loaded" ? "opacity-100" : "opacity-0"
                }`}
            />
        </div>
    )
}
