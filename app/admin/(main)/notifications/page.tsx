import { PageHeader } from "@/app/admin/components"
import { NotificationsClient } from "./notifications-client"

export const dynamic = "force-dynamic"

export default function AdminNotificationsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="通知中心"
                description="集中查看未读 / 已读消息，支持单条标记与恢复"
            />
            <NotificationsClient />
        </div>
    )
}
