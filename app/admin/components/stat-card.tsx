import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
    label: string
    value: string | number
    icon: LucideIcon
    borderColor: string
    iconColor: string
    active?: boolean
    href?: string
}

export function StatCard({
    label,
    value,
    icon: Icon,
    borderColor,
    iconColor,
    active,
    href,
}: StatCardProps) {
    const card = (
        <Card
            className={`border-l-4 ${borderColor} transition-colors ${
                href ? "hover:bg-accent/50 cursor-pointer" : ""
            } ${active ? "ring-2 ring-primary/20 bg-accent/30" : ""}`}
        >
            <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{label}</p>
                        <p className="text-2xl font-bold mt-1">{value}</p>
                    </div>
                    <Icon className={`size-8 ${iconColor} opacity-80`} />
                </div>
            </CardContent>
        </Card>
    )

    if (href) {
        return <Link href={href}>{card}</Link>
    }
    return card
}
