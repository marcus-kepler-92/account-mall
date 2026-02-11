"use client"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"

export default function SignOutButton() {
    const router = useRouter()

    return (
        <button
            onClick={async () => {
                await authClient.signOut({
                    fetchOptions: {
                        onSuccess: () => {
                            router.push("/login")
                        },
                    },
                })
            }}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
            Sign Out
        </button>
    )
}
