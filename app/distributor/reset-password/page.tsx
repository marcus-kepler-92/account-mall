import { Suspense } from "react"
import type { Metadata } from "next"
import { ResetPasswordForm } from "./reset-password-form"

export const metadata: Metadata = {
    title: "重置密码",
}

export default function ResetPasswordPage() {
    return (
        <main className="flex min-h-dvh items-center justify-center bg-background p-4 sm:p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            <Suspense>
                <ResetPasswordForm />
            </Suspense>
        </main>
    )
}
