"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Mail, Link2 } from "lucide-react"
import { InviteDistributorDialog } from "./invite-distributor-dialog"
import { GenerateLinkDialog } from "./generate-link-dialog"

export function InviteDistributorButtonClient() {
    const [emailOpen, setEmailOpen] = useState(false)
    const [linkOpen, setLinkOpen] = useState(false)

    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEmailOpen(true)}>
                <Mail className="mr-2 size-4" />
                邮箱邀请
            </Button>
            <Button onClick={() => setLinkOpen(true)}>
                <Link2 className="mr-2 size-4" />
                生成邀请链接
            </Button>
            <InviteDistributorDialog open={emailOpen} onOpenChange={setEmailOpen} />
            <GenerateLinkDialog
                open={linkOpen}
                onOpenChange={setLinkOpen}
                apiEndpoint="/api/admin/distributors/invite"
            />
        </div>
    )
}
