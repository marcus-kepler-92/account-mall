import Link from "next/link"
import { Zap } from "lucide-react"
import { config } from "@/lib/config"

export function SiteFooter() {
    const hasBusinessInfo = config.businessName || config.businessLicenseNo || config.contactEmail
    return (
        <footer className="border-t">
            <div className="mx-auto max-w-6xl px-4 py-8 space-y-4">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                        <div className="flex items-center gap-2">
                            <div className="flex size-6 items-center justify-center rounded-md bg-primary">
                                <Zap className="size-3 text-primary-foreground" />
                            </div>
                            <span className="text-sm font-medium">{config.siteName}</span>
                        </div>
                        <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <Link href="/orders/lookup" className="hover:text-foreground transition-colors">
                                订单查询
                            </Link>
                            <Link href="/terms" className="hover:text-foreground transition-colors">
                                用户协议
                            </Link>
                            <Link href="/privacy" className="hover:text-foreground transition-colors">
                                隐私政策
                            </Link>
                            <Link href="/refund" className="hover:text-foreground transition-colors">
                                售后政策
                            </Link>
                        </nav>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        &copy; {new Date().getFullYear()} {config.siteName} 版权所有
                    </p>
                </div>
                {hasBusinessInfo && (
                    <div className="border-t pt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        {config.businessName && <span>经营者：{config.businessName}</span>}
                        {config.businessLicenseNo && <span>统一社会信用代码：{config.businessLicenseNo}</span>}
                        {config.contactEmail && <span>联系邮箱：{config.contactEmail}</span>}
                    </div>
                )}
            </div>
        </footer>
    )
}
