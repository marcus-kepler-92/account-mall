import type { Metadata } from "next"
import { SiteHeader } from "@/app/components/site-header"
import { SiteFooter } from "@/app/components/site-footer"
import { config } from "@/lib/config"

export const metadata: Metadata = {
    title: "隐私政策",
    robots: { index: false },
}

const EFFECTIVE_DATE = "2026年3月17日"
const contactEmail = config.contactEmail || "【联系邮箱】"

export default function PrivacyPage() {
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">
                <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
                    <article className="prose prose-neutral dark:prose-invert max-w-none">
                        <h1>隐私政策</h1>
                        <p className="text-sm text-muted-foreground not-prose mb-8">
                            更新日期：{EFFECTIVE_DATE}　　生效日期：{EFFECTIVE_DATE}
                        </p>

                        <h2>一、信息收集</h2>
                        <p>我们收集以下信息以提供服务：</p>
                        <ul>
                            <li><strong>订单信息</strong>：您的电子邮件地址、订单编号、支付金额；</li>
                            <li><strong>设备信息</strong>：IP 地址、浏览器类型，用于安全防护和欺诈识别；</li>
                            <li>
                                <strong>支付信息</strong>：由第三方支付机构（如支付宝）处理，
                                本公司仅保留支付状态，不保存完整支付凭证。
                            </li>
                        </ul>

                        <h2>二、信息使用</h2>
                        <p>收集的信息仅用于以下目的：</p>
                        <ol>
                            <li>履行订单，向您发送数字内容；</li>
                            <li>处理投诉和售后请求；</li>
                            <li>防范欺诈、滥用和违法行为；</li>
                            <li>履行法律法规要求的合规义务。</li>
                        </ol>

                        <h2>三、信息共享</h2>
                        <p>我们不向第三方出售您的个人信息。以下情形除外：</p>
                        <ol>
                            <li>依法配合司法机关、执法机构的合法调查；</li>
                            <li>处理您的支付所必须涉及的支付服务提供商（如支付宝）。</li>
                        </ol>

                        <h2>四、数据保留</h2>
                        <p>
                            订单及相关个人数据保留期限不超过 5 年，以满足法律合规要求。
                            超出保留期限的数据将予以删除或匿名化处理。
                        </p>

                        <h2>五、用户权利</h2>
                        <p>
                            您有权要求查阅、更正或删除您的个人信息。
                            请发送邮件至 {contactEmail} 提出请求，我们将在 15 个工作日内回复。
                        </p>

                        <h2>六、Cookie</h2>
                        <p>
                            本平台仅使用维持会话状态所必需的 Cookie，不使用追踪型或广告型 Cookie。
                        </p>

                        <h2>七、未成年人隐私</h2>
                        <p>
                            本平台不面向未成年人，不会故意收集未成年人的个人信息。
                            如发现误收集，将予以及时删除。
                        </p>

                        <h2>八、联系我们</h2>
                        <p>如对本政策有疑问，请联系：{contactEmail}</p>
                    </article>
                </div>
            </main>
            <SiteFooter />
        </div>
    )
}
