import { create } from "zustand"

export type TurnstileStatus = "idle" | "loading" | "interactive" | "ready" | "expired" | "error" | "unsupported"

export const useTurnstileStore = create<{
    token: string | null
    status: TurnstileStatus
    setToken: (token: string) => void
    clearToken: () => void
    setStatus: (status: TurnstileStatus) => void
    reset: () => void
}>((set) => ({
    token: null,
    status: "idle",
    setToken: (token) => set({ token, status: "ready" }),
    clearToken: () => set({ token: null }),
    setStatus: (status) => set({ status }),
    reset: () => set({ token: null, status: "idle" }),
}))
