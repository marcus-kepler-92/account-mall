"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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

export function ChangePasswordForm() {
  const router = useRouter()

  const onSubmit = async ({ password }: FormValues) => {
    try {
      const res = await fetch("/api/distributor/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? "修改失败")
        return
      }
      toast.success("密码已修改，正在跳转...")
      router.replace("/distributor")
    } catch {
      toast.error("修改失败")
    }
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onTouched",
  })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>修改密码</CardTitle>
        <CardDescription>密码已被重置，请设置新密码后继续使用，至少 8 位</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>新密码</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
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
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 mr-1 animate-spin" />}
              确认修改
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
