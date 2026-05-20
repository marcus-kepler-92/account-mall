import { PageHeader } from "@/app/admin/components/page-header"
import { getSiteSettingRow, getSiteSettings } from "@/lib/site-settings"
import { SiteSettingsForm } from "./site-settings-form"

export const dynamic = "force-dynamic"

export default async function SiteSettingsPage() {
    const [row, effective] = await Promise.all([getSiteSettingRow(), getSiteSettings()])

    return (
        <div className="space-y-6">
            <PageHeader
                title="系统设置"
                description="平台联系方式、营业时间、合规信息。留空回退到环境变量默认值。"
            />
            <SiteSettingsForm row={row} effective={effective} />
        </div>
    )
}
