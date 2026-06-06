"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PasswordRevealDialogProps {
  password: string
  open: boolean
  onClose: () => void
  description?: string
}

/** One-time display of a freshly generated password after an admin reset. */
export function PasswordRevealDialog({
  password,
  open,
  onClose,
  description = "这是一次性密码，仅显示一次。该账号下次登录时需要修改密码。",
}: PasswordRevealDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>密码已重置</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
          <span className="flex-1 select-all">{password}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
