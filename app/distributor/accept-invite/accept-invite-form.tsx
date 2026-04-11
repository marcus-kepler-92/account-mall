"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { usernameSchema } from "@/lib/validations/distributor-invite"
import { toast } from "sonner"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

const emailFormSchema = z
  .object({
    name: z.string().min(1, "请输入昵称").max(50, "昵称不能超过 50 字符"),
    password: z.string().min(6, "密码至少 6 位").max(128, "密码不能超过 128 位"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  })

const noEmailFormSchema = z
  .object({
    username: usernameSchema,
    name: z.string().min(1, "请输入昵称").max(50, "昵称不能超过 50 字符"),
    password: z.string().min(6, "密码至少 6 位").max(128, "密码不能超过 128 位"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  })

interface AcceptInviteFormProps {
  token: string
  email: string | null
}

export function AcceptInviteForm({ token, email }: AcceptInviteFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isNoEmail = email === null

  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  })

  const noEmailForm = useForm<z.infer<typeof noEmailFormSchema>>({
    resolver: zodResolver(noEmailFormSchema),
    defaultValues: { username: "", name: "", password: "", confirmPassword: "" },
  })

  const handleEmailSubmit = async (values: z.infer<typeof emailFormSchema>) => {
    setLoading(true)
    try {
      const res = await fetch("/api/distributor/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: values.name, password: values.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "注册失败，请稍后重试")
        return
      }
      toast.success("注册成功，请登录")
      router.push("/distributor/login")
    } catch {
      toast.error("注册失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  const handleNoEmailSubmit = async (values: z.infer<typeof noEmailFormSchema>) => {
    setLoading(true)
    try {
      const res = await fetch("/api/distributor/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: values.name,
          username: values.username,
          password: values.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error?.includes("用户名已被使用")) {
          noEmailForm.setError("username", { message: data.error })
        } else {
          toast.error(data.error || "注册失败，请稍后重试")
        }
        return
      }
      toast.success("注册成功，请登录")
      router.push("/distributor/login")
    } catch {
      toast.error("注册失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  if (isNoEmail) {
    return (
      <Form {...noEmailForm}>
        <form onSubmit={noEmailForm.handleSubmit(handleNoEmailSubmit)} className="space-y-4">
          <FormField
            control={noEmailForm.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>用户名</FormLabel>
                <FormControl>
                  <Input placeholder="6-30 位字母、数字或下划线" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={noEmailForm.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>昵称</FormLabel>
                <FormControl>
                  <Input placeholder="您的昵称" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={noEmailForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>设置密码</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="至少 6 位" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={noEmailForm.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>确认密码</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="再次输入密码" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {loading ? "注册中..." : "完成注册"}
          </Button>
        </form>
      </Form>
    )
  }

  return (
    <Form {...emailForm}>
      <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">受邀邮箱</p>
          <Input value={email ?? ""} disabled className="bg-muted" />
        </div>
        <FormField
          control={emailForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>昵称</FormLabel>
              <FormControl>
                <Input placeholder="您的昵称" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={emailForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>设置密码</FormLabel>
              <FormControl>
                <Input type="password" placeholder="至少 6 位" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={emailForm.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>确认密码</FormLabel>
              <FormControl>
                <Input type="password" placeholder="再次输入密码" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {loading ? "注册中..." : "完成注册"}
        </Button>
      </form>
    </Form>
  )
}
