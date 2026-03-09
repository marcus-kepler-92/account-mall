"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"

export default function AdminForbiddenPage() {
    const router = useRouter()

    const handleSignOutAndLogin = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/admin/login")
                    router.refresh()
                },
            },
        })
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">无管理员权限</CardTitle>
                    <CardDescription>
                        当前账号不是管理员，无法访问后台。请退出后使用管理员账号登录。
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <Button variant="default" onClick={handleSignOutAndLogin}>
                        退出并重新登录
                    </Button>
                    <Button asChild variant="ghost">
                        <Link href="/">返回首页</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
