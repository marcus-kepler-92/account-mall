"use client"

import { GenerateLinkDialog } from "@/app/components/generate-link-dialog"

interface GenerateInviteLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerateInviteLinkDialog({ open, onOpenChange }: GenerateInviteLinkDialogProps) {
  return (
    <GenerateLinkDialog
      open={open}
      onOpenChange={onOpenChange}
      apiEndpoint="/api/distributor/invite"
    />
  )
}
