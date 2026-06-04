import { getCrossSellSetting } from "@/lib/cross-sell"
import { PageHeader } from "@/app/admin/components/page-header"
import { CrossSellSettingsForm } from "./cross-sell-settings-form"

export const dynamic = "force-dynamic"

export default async function CrossSellSettingPage() {
    const setting = await getCrossSellSetting()

    return (
        <div className="space-y-6">
            <PageHeader
                title="联推折扣"
                description="配置订单成功页的限时联推折扣，引导用户购买其他商品"
            />
            <CrossSellSettingsForm setting={setting} />
        </div>
    )
}
