import type { FieldValues, Path, UseFormSetError } from "react-hook-form"

export function applyFieldErrors<T extends FieldValues>(
    data: { code?: string; details?: { fieldErrors?: Record<string, string[]> } },
    setError: UseFormSetError<T>
) {
    if (data.code !== "VALIDATION_FAILED" || !data.details?.fieldErrors) return
    for (const [field, messages] of Object.entries(data.details.fieldErrors)) {
        const msg = Array.isArray(messages) ? messages[0] : String(messages)
        if (msg) setError(field as Path<T>, { type: "server", message: msg })
    }
}
