import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"
import { config } from "@/lib/config"

export default function AdminNotFound() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
            <div className="flex flex-col items-center text-center">
                <div className="mb-6 rounded-full bg-muted p-6">
                    <FileQuestion className="size-16 text-muted-foreground" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight">404</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    页面不存在
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    您访问的{config.adminPanelLabel}页面可能不存在
                </p>
                <Button asChild className="mt-8">
                    <Link href="/admin/dashboard">返回仪表盘</Link>
                </Button>
            </div>
        </div>
    )
}
