"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Mail, Link2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { GenerateInviteLinkDialog } from "./generate-invite-link-dialog"

const formSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
})

interface InviteSubDistributorButtonProps {
  level2RatePercent: number
}

export function InviteSubDistributorButton({
  level2RatePercent,
}: InviteSubDistributorButtonProps) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleEmailOpenChange = (open: boolean) => {
    if (!open) form.reset()
    setEmailOpen(open)
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true)
    try {
      const res = await fetch("/api/distributor/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "邀请失败，请稍后重试")
        return
      }
      toast.success(`邀请邮件已发送至 ${values.email}`)
      form.reset()
      setEmailOpen(false)
    } catch {
      toast.error("邀请失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setEmailOpen(true)}>
          <Mail className="mr-2 size-4" />
          邮箱邀请
        </Button>
        <Button onClick={() => setLinkOpen(true)}>
          <Link2 className="mr-2 size-4" />
          生成邀请链接
        </Button>
      </div>
      <Dialog open={emailOpen} onOpenChange={handleEmailOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>邮箱邀请团队成员</DialogTitle>
            <DialogDescription>
              输入对方邮箱发送邀请，对方注册后每笔成交，您持续获得其佣金的 {level2RatePercent}%。
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="请输入对方邮箱地址" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleEmailOpenChange(false)}
                  disabled={loading}
                >
                  取消
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {loading ? "发送中..." : "发送邀请"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <GenerateInviteLinkDialog open={linkOpen} onOpenChange={setLinkOpen} />
    </>
  )
}
