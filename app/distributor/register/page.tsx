import { Suspense } from "react"
import { RegisterForm } from "./register-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function RegisterFormSkeleton() {
    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">分销员注册</CardTitle>
                <CardDescription>加载中…</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    )
}

export default function DistributorRegisterPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
            <Suspense fallback={<RegisterFormSkeleton />}>
                <RegisterForm />
            </Suspense>
        </div>
    )
}
