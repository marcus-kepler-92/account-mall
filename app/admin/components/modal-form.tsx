"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

interface ModalFormProps {
    trigger: ReactNode
    title: string
    description?: string
    /** Controlled open state. If provided, component becomes controlled. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children: ReactNode
}

/**
 * Thin wrapper around Dialog for modal forms.
 * When uncontrolled (no open prop), manages open state internally via trigger click.
 * Form submission and close logic should be handled by the child form component.
 */
export function ModalForm({
    trigger,
    title,
    description,
    open,
    onOpenChange,
    children,
}: ModalFormProps) {
    const [internalOpen, setInternalOpen] = useState(false)

    const isControlled = open !== undefined
    const isOpen = isControlled ? open : internalOpen
    const handleOpenChange = isControlled ? onOpenChange : setInternalOpen

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    )
}
