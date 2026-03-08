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
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4">
                <DistributorNav />
                <DistributorTopbarActions />
            </header>
            <main className="p-6">
                {children}
            </main>
        </div>
    )
}
