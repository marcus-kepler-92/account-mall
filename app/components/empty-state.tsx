import { type ReactNode } from "react"
import { Package } from "lucide-react"

type EmptyStateProps = {
    icon?: ReactNode
    title: string
    description: string
    action?: ReactNode
    className?: string
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className = "",
}: EmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
        >
            <div className="rounded-full bg-muted p-4 mb-4">
                {icon ?? <Package className="size-8 text-muted-foreground" />}
            </div>
            <h3 className="font-semibold text-lg mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
            {action}
        </div>
    )
}
