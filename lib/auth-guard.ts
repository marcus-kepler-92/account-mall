import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Get the current admin session from the request.
 * Returns the session object if authenticated, null otherwise.
 * Use in Server Components and API Route handlers.
 */
export async function getAdminSession() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    return session;
}
