import type { Metadata } from "next"
import { SiteHeader } from "@/app/components/site-header"
import { SiteFooter } from "@/app/components/site-footer"

export const metadata: Metadata = {
    title: "售后与退款政策",
    robots: { index: false },
}

const EFFECTIVE_DATE = "2026年3月17日"

export default function RefundPage() {
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">
                <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
                    <article className="prose prose-neutral dark:prose-invert max-w-none">
                        <h1>售后与退款政策</h1>
                        <p className="text-sm text-muted-foreground not-prose mb-8">
                            更新日期：{EFFECTIVE_DATE}　　生效日期：{EFFECTIVE_DATE}
                        </p>

                        <h2>一、服务性质说明</h2>
                        <p>
                            本平台提供信息技术服务和数字内容服务。数字内容一经交付即可使用，
                            适用国家关于数字内容商品的相关退款规定。
                        </p>

                        <h2>二、可申请退款的情形</h2>
                        <p>以下情形您可申请全额退款：</p>
                        <ol>
                            <li>付款成功后系统未能自动发货，且客服无法在 24 小时内补发；</li>
                            <li>交付内容与描述严重不符（如账号区域错误）。</li>
                        </ol>

                        <h2>三、不予退款的情形</h2>
                        <p>以下情形不予退款：</p>
                        <ol>
                            <li>账号因您的操作导致封禁（如自行修改账号信息、在不兼容设备上登录等）；</li>
                            <li>
                                Apple Inc. 因平台政策封禁账号——此属第三方行为，
                                本公司已在《用户服务协议》中明确披露该风险；
                            </li>
                            <li>数字内容已交付且您已使用；</li>
                            <li>超过交付日起 72 小时后提出的退款申请；</li>
                            <li>未按本平台说明和流程操作（如无法提供有效截图等证明材料）导致无法核实问题的。</li>
                        </ol>

                        <h2>四、申请方式</h2>
                        <p>
                            如需申请售后，请直接联系在线客服，客服将在 1 个工作日内处理。
                        </p>

                        <h2>五、退款处理</h2>
                        <p>
                            审核通过的退款将在 3 个工作日内原路退回至您的支付账户。
                        </p>
                    </article>
                </div>
            </main>
            <SiteFooter />
        </div>
    )
}
