import Link from "next/link"
import { prisma } from "@/lib/prisma"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { AcceptInviteForm } from "./accept-invite-form"

interface AcceptInvitePageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const { token } = await searchParams

  if (!token) {
    return <InvalidInvite reason="missing" />
  }

  const invitation = await prisma.distributorInvitation.findUnique({
    where: { token },
    select: { email: true, expiresAt: true, maxUses: true, usedCount: true },
  })

  if (!invitation) {
    return <InvalidInvite reason="notfound" />
  }

  if (invitation.expiresAt < new Date()) {
    return <InvalidInvite reason="expired" />
  }

  if (invitation.usedCount >= invitation.maxUses) {
    return <InvalidInvite reason="exhausted" />
  }

  const isNoEmail = invitation.email === null

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>设置登录{isNoEmail ? "用户名" : "密码"}</CardTitle>
          <CardDescription>
            {isNoEmail
              ? "您已被邀请加入分销中心，请设置用户名和密码以完成注册，用户名将作为您的登录账号。"
              : "您已被邀请加入分销中心，请设置密码以完成注册。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm token={token} email={invitation.email} />
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground">
            已有账号？{" "}
            <Link href="/distributor/login" className="underline underline-offset-2">
              登录
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}

function InvalidInvite({ reason }: { reason: "missing" | "notfound" | "exhausted" | "expired" }) {
  const messages = {
    missing: "邀请链接无效，缺少必要参数。",
    notfound: "邀请链接无效或不存在。",
    exhausted: "此邀请链接的注册名额已满，请联系邀请人重新生成链接。",
    expired: "邀请链接已过期，请联系邀请人重新发送邀请。",
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <AlertCircle className="size-12 text-destructive" />
          </div>
          <CardTitle>邀请链接无效</CardTitle>
          <CardDescription>{messages[reason]}</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="justify-center">
          <Button variant="outline" asChild>
            <Link href="/distributor/login">← 返回登录页</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
