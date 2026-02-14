"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export function BackButton() {
    const router = useRouter()
    return (
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="返回上一页">
            <ArrowLeft className="size-4" />
        </Button>
    )
}
