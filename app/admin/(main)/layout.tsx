import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/app/components/admin-sidebar"
import { AdminBreadcrumb } from "@/app/components/admin-breadcrumb"
import { AdminTopbarActions } from "@/app/components/admin-topbar-actions"

export default function AdminMainLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <SidebarProvider>
            <AdminSidebar />
            <SidebarInset>
                {/* Top bar with sidebar trigger */}
                <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <AdminBreadcrumb />
                    <AdminTopbarActions />
                </header>

                {/* Page content */}
                <div className="flex-1 p-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
