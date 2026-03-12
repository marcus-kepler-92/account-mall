"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DistributorRegisterPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const inviteCode = searchParams.get("inviteCode")?.trim() || null

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await authClient.signUp.email({
                name,
                email,
                password,
                fetchOptions: {
                    onSuccess: async () => {
                        if (inviteCode) {
                            try {
                                const res = await fetch("/api/distributor/bind-inviter", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ inviteCode }),
                                })
                                if (!res.ok) {
                                    const data = await res.json().catch(() => ({}))
                                    toast.error(data.error ?? "绑定邀请人失败")
                                }
                            } catch {
                                toast.error("绑定邀请人失败")
                            }
                        }
                        toast.success("注册成功，请登录")
                        router.push("/distributor/login")
                        router.refresh()
                    },
                    onError: (ctx) => {
                        toast.error(ctx.error.message)
                    }
                }
            })
        } catch {
            toast.error("发生未知错误")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        分销员注册
                    </CardTitle>
                    <CardDescription>
                        {inviteCode
                            ? "您正在通过邀请链接注册，注册成功后将绑定邀请人。"
                            : "注册成为分销员，获取推广链接与佣金"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">昵称</Label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="您的昵称"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">邮箱</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="your@email.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">密码</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="pr-10"
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
                            className="w-full"
                        >
                            {loading ? "注册中..." : "注册"}
                        </Button>

                        <p className="text-center text-sm text-muted-foreground">
                            已有账号？{" "}
                            <Link href="/distributor/login" className="underline hover:text-foreground">
                                去登录
                            </Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
