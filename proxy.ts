import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public pages that never require authentication
const PUBLIC_PAGE_PREFIXES = ["/products", "/orders"];
const PUBLIC_EXACT_PAGES = ["/", "/admin/login"];

// Public API routes that never require authentication
const PUBLIC_API_PREFIXES = [
    "/api/auth",
    "/api/payment",
];
const PUBLIC_API_EXACT = [
    "/api/orders/by-email",
    "/api/orders/lookup",
];

// Protected API routes that require admin authentication
const PROTECTED_API_PREFIXES = ["/api/cards"];

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

    // Protected API prefixes
    if (PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
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

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const method = request.method;

    // 1. Admin login page: redirect to dashboard if already authenticated
    if (pathname === "/admin/login") {
        const sessionCookie = request.cookies.get("better-auth.session_token");
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
                    if (session?.session) {
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

    // 2. Allow all public pages
    if (isPublicPage(pathname)) {
        return NextResponse.next();
    }

    // 3. Allow all public APIs
    if (isPublicApi(pathname, method)) {
        return NextResponse.next();
    }

    // 4. For protected routes, validate session
    if (isProtectedRoute(pathname, method)) {
        const sessionCookie = request.cookies.get("better-auth.session_token");

        // No cookie -> redirect pages or 401 for APIs
        if (!sessionCookie) {
            if (pathname.startsWith("/api/")) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }

        // Validate session by calling the auth API endpoint
        const response = await fetch(
            new URL("/api/auth/get-session", request.nextUrl.origin),
            {
                headers: {
                    cookie: request.headers.get("cookie") || "",
                },
            }
        );

        if (!response.ok) {
            if (pathname.startsWith("/api/")) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }

        const session = await response.json();
        if (!session?.session) {
            if (pathname.startsWith("/api/")) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }
    }

    // 5. Everything else passes through
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
