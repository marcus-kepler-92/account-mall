"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { translateAuthError } from "@/lib/auth-errors"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DistributorLoginPage() {
    const router = useRouter()
    const [account, setAccount] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const isEmail = account.includes("@")
            const normalizedAccount = isEmail ? account.trim() : account.trim().toLowerCase()

            if (isEmail) {
                const { error: signInError } = await authClient.signIn.email({
                    email: normalizedAccount,
                    password,
                    fetchOptions: {
                        onError: (ctx) => {
                            toast.error(translateAuthError(ctx.error.message))
                        },
                    },
                })
                if (signInError) return
            } else {
                const { error: signInError } = await authClient.signIn.username({
                    username: normalizedAccount,
                    password,
                    fetchOptions: {
                        onError: (ctx) => {
                            toast.error(translateAuthError(ctx.error.message))
                        },
                    },
                })
                if (signInError) return
            }

            const { data: session } = await authClient.getSession()
            const role = (session?.user as { role?: string } | undefined)?.role
            if (role === "DISTRIBUTOR") {
                toast.success("登录成功")
                router.push("/distributor")
                router.refresh()
            } else {
                toast.error("请使用管理员入口登录")
                await authClient.signOut()
                router.refresh()
            }
        } catch {
            toast.error("发生未知错误")
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="flex min-h-dvh items-center justify-center bg-background p-4 sm:p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        分销中心登录
                    </CardTitle>
                    <CardDescription>
                        登录您的分销员账号
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="account">账号</Label>
                            <Input
                                id="account"
                                type="text"
                                inputMode="email"
                                autoComplete="username email"
                                value={account}
                                onChange={(e) => setAccount(e.target.value)}
                                required
                                placeholder="邮箱或用户名"
                                className="min-h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">密码</Label>
                                <Link
                                    href="/distributor/forgot-password"
                                    className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                    tabIndex={-1}
                                >
                                    忘记密码？
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="min-h-11 pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword((v) => !v)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                                >
                                    {showPassword ? (
                                        <EyeOff className="size-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="size-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full min-h-11"
                        >
                            {loading ? "登录中..." : "登录"}
                        </Button>

                        <p className="text-center text-sm text-muted-foreground">
                            还没有账号？请联系已有分销员获取邀请链接
                        </p>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
