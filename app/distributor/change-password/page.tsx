import { redirect } from "next/navigation"
import { getSessionForDistributorArea } from "@/lib/auth-guard"
import { ChangePasswordForm } from "./change-password-form"

export default async function DistributorChangePasswordPage() {
  const result = await getSessionForDistributorArea()
  if (!result || result.disabled) redirect("/distributor/login")
  if (!result.mustChangePassword) redirect("/distributor")

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <ChangePasswordForm />
    </div>
  )
}
