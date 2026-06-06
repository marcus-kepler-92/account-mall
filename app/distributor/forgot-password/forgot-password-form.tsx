"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, MailCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { authClient } from "@/lib/auth-client"
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
    email: z.string().email("请输入有效的邮箱地址"),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordForm() {
    const [sent, setSent] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: "" },
        mode: "onTouched",
    })

    const onSubmit = async ({ email }: FormValues) => {
        const { error } = await authClient.requestPasswordReset({
            email: email.trim(),
            redirectTo: "/distributor/reset-password",
        })
        if (error) {
            // Rate limited or transient failure; the endpoint never reveals
            // whether the email is registered.
            toast.error("请求过于频繁，请稍后再试")
            return
        }
        setSent(true)
    }

    if (sent) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <MailCheck className="mx-auto size-10 text-green-500" />
                    <CardTitle className="text-2xl font-bold">邮件已发送</CardTitle>
                    <CardDescription>
                        若该邮箱已注册分销员账号，重置链接已发送，请查收（链接 1 小时内有效）
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground">
                    <Link href="/distributor/login" className="underline underline-offset-4 hover:text-foreground">
                        返回登录
                    </Link>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">忘记密码</CardTitle>
                <CardDescription>
                    输入注册邮箱，我们将发送重置链接
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>邮箱</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="email"
                                            inputMode="email"
                                            autoComplete="email"
                                            placeholder="you@example.com"
                                            className="min-h-11"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full min-h-11">
                            {form.formState.isSubmitting && <Loader2 className="size-4 mr-1 animate-spin" />}
                            发送重置链接
                        </Button>
                        <div className="space-y-1 text-center text-sm text-muted-foreground">
                            <p>
                                <Link href="/distributor/login" className="underline underline-offset-4 hover:text-foreground">
                                    返回登录
                                </Link>
                            </p>
                            <p>用户名登录的无邮箱账号，请联系管理员重置密码</p>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
