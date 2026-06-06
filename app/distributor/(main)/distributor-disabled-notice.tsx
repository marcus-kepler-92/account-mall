"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Ban, Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Shown by the (main) layout when the distributor is disabled. Rendering a
 * notice (instead of redirecting to /distributor/login) avoids the redirect
 * loop: proxy bounces logged-in distributors from the login page back to
 * /distributor.
 */
export function DistributorDisabledNotice() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleSignOut = async () => {
        setLoading(true)
        try {
            await authClient.signOut()
            router.replace("/distributor/login")
            router.refresh()
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="flex min-h-dvh items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <Ban className="mx-auto size-10 text-destructive" />
                    <CardTitle className="text-2xl font-bold">账号已停用</CardTitle>
                    <CardDescription>
                        您的分销员账号已被停用，如有疑问请联系管理员
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleSignOut} disabled={loading} variant="outline" className="w-full">
                        {loading && <Loader2 className="size-4 mr-1 animate-spin" />}
                        退出登录
                    </Button>
                </CardContent>
            </Card>
        </main>
    )
}
