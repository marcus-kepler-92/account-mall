"use client"

import { useFormState } from "react-hook-form"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { FieldErrors } from "react-hook-form"

type Props = {
    /**
     * Map of field key → human-readable label. The summary surfaces only the
     * fields listed here so internal field paths never leak to users. Unknown
     * fields are summarized under a single generic bucket.
     */
    fieldLabels?: Record<string, string>
}

type FlatError = { key: string; label: string; message: string }

/**
 * Top-of-form error summary banner. Listens to react-hook-form's submitCount +
 * errors and renders a clickable list of top-level field errors after the
 * first failed submit. Clicking a row scrolls to and focuses the corresponding
 * input.
 *
 * Field-level errors from FormField/FormMessage stay in place — this is the
 * "scroll bumper" for users who don't see the inline messages.
 */
export function FormValidationSummary({ fieldLabels }: Props) {
    const { errors, submitCount } = useFormState()
    const flat = flattenErrors(errors, fieldLabels)

    if (submitCount === 0 || flat.length === 0) return null

    return (
        <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertTitle>请修复 {flat.length} 处错误后再提交</AlertTitle>
            <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {flat.map((e) => (
                        <li key={e.key}>
                            <button
                                type="button"
                                className="text-left underline-offset-2 hover:underline focus:outline-none focus:underline"
                                onClick={() => focusField(e.key)}
                            >
                                <span className="font-medium">{e.label}</span>
                                <span>：{e.message}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    )
}

function flattenErrors(
    errors: FieldErrors,
    labels?: Record<string, string>,
): FlatError[] {
    const out: FlatError[] = []
    for (const [key, err] of Object.entries(errors)) {
        if (!err) continue
        const label = labels?.[key] ?? key
        // Top-level message (e.g. superRefine path-targeted errors like variants).
        if (typeof err === "object" && "message" in err && err.message) {
            out.push({ key, label, message: String(err.message) })
            continue
        }
        // Array-of-fields (e.g. variants[*]) — surface a single roll-up entry
        // so users don't get spammed with row-level paths.
        if (Array.isArray(err)) {
            const count = err.filter(Boolean).length
            if (count > 0) {
                out.push({
                    key,
                    label,
                    message: `${count} 项存在错误，请检查下方表单`,
                })
            }
        }
    }
    return out
}

function focusField(key: string) {
    if (typeof document === "undefined") return
    // Strip array indices for the selector (e.g. variants.0.name → variants).
    const root = key.replace(/\.\d+.*$/, "")
    const el =
        document.querySelector<HTMLElement>(`[name="${root}"]`) ??
        document.querySelector<HTMLElement>(`[data-field="${root}"]`) ??
        document.getElementById(root)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    if (typeof (el as HTMLInputElement).focus === "function") {
        ;(el as HTMLInputElement).focus({ preventScroll: true })
    }
}
