import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth");
    const isPublicPage = ["/login", "/register"].includes(request.nextUrl.pathname);

    // Allow auth API routes and public pages without session check
    if (isAuthRoute || isPublicPage) {
        return NextResponse.next();
    }

    // Quick check: if no cookie at all, redirect immediately (avoid unnecessary fetch)
    const sessionCookie = request.cookies.get("better-auth.session_token");
    if (!sessionCookie) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Validate session by calling the auth API endpoint
    const response = await fetch(
        new URL("/api/auth/get-session", request.nextUrl.origin),
        {
            headers: {
                cookie: request.headers.get("cookie") || "",
            },
        },
    );

    if (!response.ok) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const session = await response.json();
    if (!session?.session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
