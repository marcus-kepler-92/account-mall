import { redirect } from "next/navigation"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/app/components/admin-sidebar"
import { AdminBreadcrumb } from "@/app/components/admin-breadcrumb"
import { AdminTopbarActions } from "@/app/components/admin-topbar-actions"
import { getAdminPermissions } from "@/lib/admin-permissions"
import { VisibilityRefresh } from "@/app/components/visibility-refresh"
import { NotificationTabIndicator } from "@/app/admin/components"

export default async function AdminMainLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const perms = await getAdminPermissions()
    if (!perms) {
        redirect("/admin/login")
    }
    if (perms.mustChangePassword) {
        redirect("/admin/change-password")
    }

    return (
        <SidebarProvider>
            <VisibilityRefresh />
            <NotificationTabIndicator />
            <AdminSidebar allowedMenus={perms.allowedMenus} isSuperAdmin={perms.isSuperAdmin} />
            <SidebarInset>
                <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
                    <SidebarTrigger className="-ml-1" />
                    <div className="flex-1 min-w-0">
                        <AdminBreadcrumb />
                    </div>
                    <AdminTopbarActions name={perms.name} email={perms.email} />
                </header>
                <div className="flex-1 min-w-0 p-3 sm:p-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
