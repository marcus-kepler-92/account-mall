"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"

const schema = z.object({
    name: z.string().min(1, "请输入昵称").max(50, "昵称不能超过 50 字符"),
    email: z.string().email("请输入有效的邮箱地址"),
    password: z.string().min(6, "密码至少 6 位").max(128, "密码不能超过 128 位"),
})

type FormValues = z.infer<typeof schema>

export function RegisterForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const inviteCode = searchParams.get("inviteCode")?.trim() || null
    const [showPassword, setShowPassword] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", email: "", password: "" },
        mode: "onTouched",
    })

    const onSubmit = async ({ name, email, password }: FormValues) => {
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
                    },
                },
            })
        } catch {
            toast.error("发生未知错误")
        }
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">分销员注册</CardTitle>
                <CardDescription>
                    {inviteCode
                        ? "您正在通过邀请链接注册，注册成功后将绑定邀请人。"
                        : "注册成为分销员，获取推广链接与佣金"}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>昵称</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            placeholder="您的昵称"
                                            disabled={form.formState.isSubmitting}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>邮箱</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="email"
                                            placeholder="your@email.com"
                                            disabled={form.formState.isSubmitting}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>密码</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                className="pr-10"
                                                disabled={form.formState.isSubmitting}
                                                {...field}
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
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button
                            type="submit"
                            disabled={form.formState.isSubmitting}
                            className="w-full"
                        >
                            {form.formState.isSubmitting && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            {form.formState.isSubmitting ? "注册中…" : "注册"}
                        </Button>
                        <p className="text-center text-sm text-muted-foreground">
                            已有账号？{" "}
                            <Link
                                href="/distributor/login"
                                className="underline hover:text-foreground"
                            >
                                去登录
                            </Link>
                        </p>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
