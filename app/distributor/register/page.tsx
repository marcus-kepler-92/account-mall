import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserX } from "lucide-react";

export default function DistributorRegisterPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <UserX className="size-12 text-muted-foreground" />
          </div>
          <CardTitle>分销员注册已关闭</CardTitle>
          <CardDescription>
            目前仅支持受邀加入。如需成为分销员，请联系已有分销员获取邀请，或联系管理员。
          </CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="justify-center">
          <Button variant="outline" asChild>
            <Link href="/distributor/login">← 返回登录页</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
