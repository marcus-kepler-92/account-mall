import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
            <div className="flex flex-col items-center text-center">
                <div className="mb-6 rounded-full bg-muted p-6">
                    <FileQuestion className="size-16 text-muted-foreground" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight">404</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    页面不存在
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    您访问的页面可能已被移除或链接有误
                </p>
                <Button asChild className="mt-8">
                    <Link href="/">返回首页</Link>
                </Button>
            </div>
        </div>
    )
}
