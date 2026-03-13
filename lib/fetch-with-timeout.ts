/**
 * Wrapper around native fetch that adds an automatic timeout via AbortController.
 * When the timeout fires the request is aborted and the returned promise rejects
 * with an AbortError, which TanStack Query's retry logic can then handle.
 */
export function fetchWithTimeout(
    url: string,
    opts?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
    const { timeoutMs = 15_000, ...init } = opts ?? {}
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    if (init.signal) {
        init.signal.addEventListener("abort", () => controller.abort())
    }

    return fetch(url, { ...init, signal: controller.signal }).finally(() =>
        clearTimeout(timer)
    )
}
