import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public pages that never require authentication
const PUBLIC_PAGE_PREFIXES = ["/products", "/orders"];
const PUBLIC_EXACT_PAGES = ["/", "/admin/login", "/distributor/login", "/distributor/register"];

// Public API routes that never require authentication
const PUBLIC_API_PREFIXES = [
    "/api/auth",
    "/api/payment",
];
const PUBLIC_API_EXACT = [
    "/api/orders/by-email",
    "/api/orders/lookup",
    "/api/orders/lookup-by-email",
    "/api/orders/get-payment-url",
];

// Protected API routes that require admin authentication
const PROTECTED_API_PREFIXES = ["/api/cards", "/api/admin"];
// API routes that require distributor authentication (session + role checked in handler)
const DISTRIBUTOR_API_PREFIX = "/api/distributor";

/**
 * Check if the request path is a public page route
 */
function isPublicPage(pathname: string): boolean {
    if (PUBLIC_EXACT_PAGES.includes(pathname)) return true;
    return PUBLIC_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Check if the request path is a public API route
 */
function isPublicApi(pathname: string, method: string): boolean {
    // Auth and payment APIs are always public
    if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return true;
    }

    // Specific public API endpoints
    if (PUBLIC_API_EXACT.includes(pathname)) return true;

    // GET /api/products is public (browsing), but POST/PUT/DELETE require admin
    if (pathname.startsWith("/api/products") && method === "GET") {
        return true;
    }

    // POST /api/orders is public (customer creates order)
    if (pathname === "/api/orders" && method === "POST") {
        return true;
    }

    // Restock subscription API (subscribe / check status) is public
    if (pathname.startsWith("/api/restock-subscriptions")) {
        return true;
    }

    return false;
}

/**
 * Check if the request path requires distributor authentication (session only; role checked in layout)
 */
function isDistributorProtectedPage(pathname: string): boolean {
    return (
        pathname.startsWith("/distributor") &&
        pathname !== "/distributor/login" &&
        pathname !== "/distributor/register"
    );
}

/**
 * Check if the request path is admin-only (requires ADMIN role).
 * Used for role enforcement after session is validated.
 */
function isAdminOnlyRoute(pathname: string, method: string): boolean {
    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
        return true;
    }
    if (PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return true;
    }
    if (pathname.startsWith("/api/products") && method !== "GET") {
        return true;
    }
    if (
        pathname.startsWith("/api/orders") &&
        !PUBLIC_API_EXACT.includes(pathname) &&
        !(pathname === "/api/orders" && method === "POST")
    ) {
        return true;
    }
    return false;
}

/**
 * Check if the request path requires admin authentication
 */
function isProtectedRoute(pathname: string, method: string): boolean {
    // Admin pages (except login page)
    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
        return true;
    }

    // Distributor pages (except login/register) require session
    if (isDistributorProtectedPage(pathname)) {
        return true;
    }

    // Protected API prefixes (admin)
    if (PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return true;
    }

    // Distributor API (session required; role checked in API)
    if (pathname.startsWith(DISTRIBUTOR_API_PREFIX)) {
        return true;
    }

    // Write operations on /api/products require admin
    if (pathname.startsWith("/api/products") && method !== "GET") {
        return true;
    }

    // Admin order management API (GET /api/orders, GET /api/orders/:id, etc.)
    // POST /api/orders is public, handled in isPublicApi
    if (
        pathname.startsWith("/api/orders") &&
        !PUBLIC_API_EXACT.includes(pathname) &&
        !(pathname === "/api/orders" && method === "POST")
    ) {
        return true;
    }

    return false;
}

/** Session cookie name: dev uses "better-auth.session_token", production uses "__Secure-better-auth.session_token". */
function getSessionCookie(request: NextRequest) {
    return (
        request.cookies.get("better-auth.session_token") ??
        request.cookies.get("__Secure-better-auth.session_token")
    );
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const method = request.method;

    // 1. Admin login page: redirect to dashboard only if already authenticated as ADMIN
    if (pathname === "/admin/login") {
        const sessionCookie = getSessionCookie(request);
        if (sessionCookie) {
            try {
                const response = await fetch(
                    new URL("/api/auth/get-session", request.nextUrl.origin),
                    {
                        headers: {
                            cookie: request.headers.get("cookie") || "",
                        },
                    }
                );
                if (response.ok) {
                    const session = await response.json();
                    const user = session?.user as { role?: string } | undefined;
                    if (session?.session && user?.role === "ADMIN") {
                        return NextResponse.redirect(
                            new URL("/admin/dashboard", request.url)
                        );
                    }
                }
            } catch {
                // Fall through to allow access to login page
            }
        }
        return NextResponse.next();
    }

    // 2. Distributor login page: redirect to /distributor only if already authenticated as DISTRIBUTOR
    if (pathname === "/distributor/login") {
        const sessionCookie = getSessionCookie(request);
        if (sessionCookie) {
            try {
                const response = await fetch(
                    new URL("/api/auth/get-session", request.nextUrl.origin),
                    {
                        headers: {
                            cookie: request.headers.get("cookie") || "",
                        },
                    }
                );
                if (response.ok) {
                    const session = await response.json();
                    const user = session?.user as { role?: string } | undefined;
                    if (session?.session && user?.role === "DISTRIBUTOR") {
                        return NextResponse.redirect(
                            new URL("/distributor", request.url)
                        );
                    }
                }
            } catch {
                // Fall through to show login page
            }
        }
        return NextResponse.next();
    }

    // 3. Allow public pages (login/register are handled above and return before this)
    if (isPublicPage(pathname)) {
        return NextResponse.next();
    }

    // 4. Allow all public APIs
    if (isPublicApi(pathname, method)) {
        return NextResponse.next();
    }

    // 5. For protected routes, validate session
    if (isProtectedRoute(pathname, method)) {
        const sessionCookie = getSessionCookie(request);

        // No cookie -> redirect pages or 401 for APIs
        if (!sessionCookie) {
            if (pathname.startsWith("/api/")) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }
            if (isDistributorProtectedPage(pathname)) {
                return NextResponse.redirect(new URL("/distributor/login", request.url));
            }
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }

        // Page navigations: trust cookie presence for speed; the layout's
        // auth-guard (getSessionForAdminArea / getDistributorSession) will do
        // full session + role validation server-side.
        const isPageNavigation = !pathname.startsWith("/api/");
        if (isPageNavigation) {
            return NextResponse.next();
        }

        // API routes: full session validation + role check
        const response = await fetch(
            new URL("/api/auth/get-session", request.nextUrl.origin),
            {
                headers: {
                    cookie: request.headers.get("cookie") || "",
                },
            }
        );

        if (!response.ok) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const session = await response.json();
        if (!session?.session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userRole = (session?.user as { role?: string } | undefined)?.role;

        if (isAdminOnlyRoute(pathname, method) && userRole !== "ADMIN") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        if (pathname.startsWith(DISTRIBUTOR_API_PREFIX) && userRole !== "DISTRIBUTOR") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
    }

    // 6. Everything else passes through
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
