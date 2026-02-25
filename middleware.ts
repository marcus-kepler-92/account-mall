/**
 * Next.js middleware: re-exports proxy so /admin and protected API routes
 * are guarded by session checks. Must be named middleware.ts at project root.
 */
export { proxy as middleware } from "@/proxy"
export { config } from "@/proxy"
