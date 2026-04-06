import { redirect } from "next/navigation"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { getDistributorSession } from "@/lib/auth-guard"
import { DistributorSidebar } from "@/app/components/distributor-sidebar"
import { DistributorBreadcrumb } from "@/app/components/distributor-breadcrumb"
import { DistributorTopbarActions } from "@/app/components/distributor-topbar-actions"
import { DistributorMobileNav } from "./distributor-mobile-nav"
import { VisibilityRefresh } from "@/app/components/visibility-refresh"
import { FloatingChatLoader } from "./floating-chat-loader"

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
            <VisibilityRefresh />
            <DistributorMobileNav />
            <DistributorSidebar />
            <SidebarInset className="pb-16 md:pb-0">
                <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
                    <SidebarTrigger className="-ml-1 hidden md:flex" />
                    <DistributorBreadcrumb />
                    <DistributorTopbarActions />
                </header>
                <div className="flex-1 min-w-0 p-4 md:p-6">
                    {children}
                </div>
            </SidebarInset>
            <FloatingChatLoader />
        </SidebarProvider>
    )
}
