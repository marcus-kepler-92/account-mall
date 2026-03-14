"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import { InviteDistributorDialog } from "./invite-distributor-dialog"

export function InviteDistributorButtonClient() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <UserPlus className="mr-2 size-4" />
                邀请分销员
            </Button>
            <InviteDistributorDialog open={open} onOpenChange={setOpen} />
        </>
    )
}
