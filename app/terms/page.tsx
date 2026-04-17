import type { Metadata } from "next"
import { SiteHeader } from "@/app/components/site-header"
import { SiteFooter } from "@/app/components/site-footer"
import { config } from "@/lib/config"

export const metadata: Metadata = {
    title: "用户服务协议",
    robots: { index: false },
}

const EFFECTIVE_DATE = "2026年3月17日"
const businessName = config.businessName || "本平台"
const contactEmail = config.contactEmail || null

export default function TermsPage() {
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">
                <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
                    <article className="prose prose-neutral dark:prose-invert max-w-none">
                        <h1>用户服务协议</h1>
                        <p className="text-sm text-muted-foreground not-prose mb-8">
                            更新日期：{EFFECTIVE_DATE}　　生效日期：{EFFECTIVE_DATE}
                        </p>

                        <h2>一、总则</h2>
                        <p>
                            本协议由您（用户）与{businessName}（以下简称"本公司"）签订，适用于您通过本网站使用一切服务。
                            请您在使用前仔细阅读并理解本协议全部内容。使用本平台服务即视为您已充分阅读、理解并同意接受本协议。
                        </p>

                        <h2>二、服务定性</h2>
                        <p>
                            本协议所述服务为<strong>信息技术服务和数字内容服务</strong>。
                            本公司作为信息技术服务提供商，向用户提供数字内容访问凭证及相关技术支持服务。
                        </p>

                        <h2>三、风险告知</h2>
                        <p>您理解并同意以下事项：</p>
                        <ol>
                            <li>本平台提供的数字账号由独立第三方平台 Apple Inc. 托管和管理；</li>
                            <li>Apple Inc. 有权依据其自身服务条款随时封禁、限制或注销账号，本公司对此无控制权；</li>
                            <li>本公司不对账号的永久可用性、持续访问性作出保证；</li>
                            <li>
                                第三方平台（包括但不限于 Apple Inc.）因政策变更、技术故障、违规封禁等原因导致的服务中断或不可用，
                                本公司不承担因此产生的赔偿责任。
                            </li>
                        </ol>

                        <h2>四、用途限制</h2>
                        <p>您承诺仅将本平台服务用于合法用途。严格禁止将本服务用于以下活动：</p>
                        <ol>
                            <li>电信网络诈骗，包括但不限于利用 FaceTime、短信等实施欺诈；</li>
                            <li>网络赌博及相关违法活动；</li>
                            <li>传播违法信息、色情内容或其他违反中华人民共和国法律法规的内容；</li>
                            <li>任何其他违反中华人民共和国现行法律法规的行为。</li>
                        </ol>

                        <h2>五、用户责任</h2>
                        <p>
                            您因使用本服务从事违法活动所产生的全部法律责任由您独立承担，本公司不承担任何连带责任。
                            如因您的违法行为导致本公司遭受损失，本公司有权依法向您追偿。
                        </p>

                        <h2>六、未成年人限制</h2>
                        <p>
                            本平台仅向年满 18 周岁的完全民事行为能力人提供服务。未成年人不得使用本平台。
                            如发现未成年人使用，本公司有权立即终止服务且不予退款。
                        </p>

                        <h2>七、免责条款</h2>
                        <p>以下情形导致服务中断或用户损失的，本公司不承担赔偿责任：</p>
                        <ol>
                            <li>Apple Inc. 等第三方平台的政策调整、账号处理行为；</li>
                            <li>不可抗力（包括但不限于自然灾害、政府行为）；</li>
                            <li>用户违反本协议约定的使用规则；</li>
                            <li>用户自身设备、网络或操作原因导致的问题。</li>
                        </ol>

                        <h2>八、争议解决</h2>
                        <p>
                            本协议的订立、效力、解释、履行及争议解决均适用中华人民共和国法律。
                            如发生争议，双方应首先友好协商解决；协商不成的，任何一方均可向本公司住所地有管辖权的人民法院提起诉讼。
                        </p>

                        <h2>九、协议变更</h2>
                        <p>
                            本公司有权修改本协议。修改后的协议将在平台公示，继续使用本平台服务即视为同意修改后的协议。
                        </p>

                        <h2>十、联系方式</h2>
                        <p>如对本协议有疑问，请{contactEmail ? `联系：${contactEmail}` : "通过在线客服联系我们"}。</p>
                    </article>
                </div>
            </main>
            <SiteFooter />
        </div>
    )
}
