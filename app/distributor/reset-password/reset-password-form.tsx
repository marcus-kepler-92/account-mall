"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2, TriangleAlert } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { authClient } from "@/lib/auth-client"
import { passwordSchema, confirmPasswordRefine } from "@/lib/validations/auth"
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

const schema = z
    .object({
        password: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine(confirmPasswordRefine.fn, confirmPasswordRefine.opts)

type FormValues = z.infer<typeof schema>

function InvalidTokenCard() {
    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <TriangleAlert className="mx-auto size-10 text-destructive" />
                <CardTitle className="text-2xl font-bold">链接已失效</CardTitle>
                <CardDescription>
                    重置链接无效或已过期（有效期 1 小时），请重新申请
                </CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
                <Link href="/distributor/forgot-password" className="underline underline-offset-4 hover:text-foreground">
                    重新发送重置邮件
                </Link>
            </CardContent>
        </Card>
    )
}

export function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token") ?? ""
    const tokenError = searchParams.get("error") ?? ""

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { password: "", confirmPassword: "" },
        mode: "onTouched",
    })

    if (tokenError || !token) {
        return <InvalidTokenCard />
    }

    const onSubmit = async ({ password }: FormValues) => {
        const { error } = await authClient.resetPassword({
            newPassword: password,
            token,
        })
        if (error) {
            toast.error("重置失败，链接可能已失效，请重新申请")
            return
        }
        toast.success("密码已重置，请使用新密码登录")
        router.replace("/distributor/login")
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">设置新密码</CardTitle>
                <CardDescription>新密码至少 8 位</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>新密码</FormLabel>
                                    <FormControl>
                                        <Input type="password" autoComplete="new-password" className="min-h-11" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>确认密码</FormLabel>
                                    <FormControl>
                                        <Input type="password" autoComplete="new-password" className="min-h-11" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full min-h-11">
                            {form.formState.isSubmitting && <Loader2 className="size-4 mr-1 animate-spin" />}
                            确认重置
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
