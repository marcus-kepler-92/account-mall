"use client"

import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export function ReceiptCell({ url }: { url: string | null }) {
    const [open, setOpen] = useState(false)
    if (!url) return <span className="text-muted-foreground text-sm">—</span>
    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary hover:underline"
                onClick={() => setOpen(true)}
            >
                查看
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-[90vw] sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>收款码</DialogTitle>
                        <DialogDescription>分销员上传的收款码，打款时请核对</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center overflow-hidden rounded-md border bg-muted/30 p-4">
                        <Image
                            src={url}
                            alt="收款码"
                            width={600}
                            height={600}
                            className="max-h-[60vh] max-w-full object-contain"
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setOpen(false)}>关闭</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
