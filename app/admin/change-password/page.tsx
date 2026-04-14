import { redirect } from "next/navigation"
import { getAdminSession } from "@/lib/auth-guard"
import { ChangePasswordForm } from "./change-password-form"

export default async function ChangePasswordPage() {
  const session = await getAdminSession()
  if (!session) redirect("/admin/login")

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <ChangePasswordForm />
    </div>
  )
}
