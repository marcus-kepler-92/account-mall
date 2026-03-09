import { redirect } from "next/navigation"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { getDistributorSession } from "@/lib/auth-guard"
import { DistributorSidebar } from "@/app/components/distributor-sidebar"
import { DistributorBreadcrumb } from "@/app/components/distributor-breadcrumb"
import { DistributorTopbarActions } from "@/app/components/distributor-topbar-actions"

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
        <SidebarProvider>
            <DistributorSidebar />
            <SidebarInset>
                <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
                    <SidebarTrigger className="-ml-1" />
                    <DistributorBreadcrumb />
                    <DistributorTopbarActions />
                </header>
                <div className="flex-1 min-w-0 p-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
