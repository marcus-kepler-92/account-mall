import { redirect } from "next/navigation"
import { getDistributorSession } from "@/lib/auth-guard"
import { DistributorTopbarActions } from "@/app/components/distributor-topbar-actions"
import { DistributorNav } from "@/app/components/distributor-nav"

export default async function DistributorMainLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getDistributorSession()
    if (!session) {
        redirect("/distributor/login")
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] supports-[padding:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top)]">
                <DistributorNav />
                <DistributorTopbarActions />
            </header>
            <div className="flex-1 min-w-0 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
                {children}
            </div>
        </div>
    )
}
