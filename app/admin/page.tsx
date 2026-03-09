import { redirect } from "next/navigation"

/**
 * /admin 入口：重定向到仪表盘。
 * 若未登录，访问 /admin/dashboard 时 (main)/layout 会再重定向到 /admin/login。
 */
export default function AdminPage() {
    redirect("/admin/dashboard")
}
