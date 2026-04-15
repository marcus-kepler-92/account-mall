import { redirect } from "next/navigation"
import { getSessionForAdminArea } from "@/lib/auth-guard"
import { ChangePasswordForm } from "./change-password-form"

export default async function ChangePasswordPage() {
  const result = await getSessionForAdminArea()
  if (!result || result.role !== "ADMIN") redirect("/admin/login")
  if (!result.mustChangePassword) redirect("/admin/dashboard")

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <ChangePasswordForm />
    </div>
  )
}
