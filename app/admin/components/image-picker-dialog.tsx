"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MediaLibrary } from "./media-library"

interface ImagePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string) => void
}

export function ImagePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: ImagePickerDialogProps) {
  const handleSelect = (url: string) => {
    onSelect(url)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>选择图片</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {open && <MediaLibrary mode="picker" onSelect={handleSelect} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
