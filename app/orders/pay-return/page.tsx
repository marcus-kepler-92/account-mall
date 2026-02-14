import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"

export const dynamic = "force-dynamic"

/**
 * Alipay 同步返回页（return_url）. 支付完成后支付宝会跳转至此。
 * 提示用户到订单查询页输入订单号与密码查看卡密。
 */
export default function PayReturnPage() {
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1 px-4 py-12">
                <div className="mx-auto max-w-md">
                    <Card>
                        <CardHeader>
                            <CardTitle>支付完成</CardTitle>
                            <CardDescription>
                                请前往「订单查询」输入订单号和查询密码查看卡密。卡密也会发送至您的邮箱。
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild className="w-full gap-2">
                                <Link href="/orders/lookup">
                                    <Search className="size-4" />
                                    去订单查询
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
