import { Bell, CheckCircle2, Inbox, Truck } from "lucide-react"
import { StatCard } from "@/app/admin/components"
import type { FulfillmentFiltersState } from "./fulfillment-filters"

interface FulfillmentKpisProps {
    counts: {
        awaiting: number
        processing: number
        dunned: number
        completedToday: number
    }
    status: FulfillmentFiltersState["status"]
    dunnedOnly: boolean
}

export function FulfillmentKpis({ counts, status, dunnedOnly }: FulfillmentKpisProps) {
    return (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
                label="待接单"
                value={counts.awaiting}
                icon={Inbox}
                borderColor="border-l-warning"
                iconColor="text-warning"
                active={status === "AWAITING_FULFILLMENT" && !dunnedOnly}
                href="/admin/fulfillment?status=AWAITING_FULFILLMENT"
            />
            <StatCard
                label="处理中"
                value={counts.processing}
                icon={Truck}
                borderColor="border-l-warning"
                iconColor="text-warning"
                active={status === "PROCESSING" && !dunnedOnly}
                href="/admin/fulfillment?status=PROCESSING"
            />
            <StatCard
                label="被催"
                value={counts.dunned}
                icon={Bell}
                borderColor="border-l-destructive"
                iconColor="text-destructive"
                active={dunnedOnly}
                href="/admin/fulfillment?dunnedOnly=true"
            />
            <StatCard
                label="今日已发"
                value={counts.completedToday}
                icon={CheckCircle2}
                borderColor="border-l-success"
                iconColor="text-success"
            />
        </div>
    )
}
