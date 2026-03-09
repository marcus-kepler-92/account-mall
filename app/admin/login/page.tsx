"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdminPanelLabel } from "@/app/components/site-name-provider"

export default function AdminLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error: signInError } = await authClient.signIn.email({
                email,
                password,
                fetchOptions: {
                    onError: (ctx) => {
                        toast.error(ctx.error.message)
                    }
                }
            })
            if (signInError) return

            const { data: session } = await authClient.getSession()
            const role = (session?.user as { role?: string } | undefined)?.role
            if (role === "ADMIN") {
                toast.success("登录成功")
                router.push("/admin/dashboard")
                router.refresh()
            } else {
                toast.error("请使用分销中心入口登录")
                await authClient.signOut()
                router.refresh()
            }
        } catch {
            toast.error("发生未知错误")
        } finally {
            setLoading(false)
        }
    }

    const adminPanelLabel = useAdminPanelLabel()
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        管理员登录
                    </CardTitle>
                    <CardDescription>
                        登录 {adminPanelLabel}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">邮箱</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="admin@example.com"
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
                            {loading ? "登录中..." : "登录"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
