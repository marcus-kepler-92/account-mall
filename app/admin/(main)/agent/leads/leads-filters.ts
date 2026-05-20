export type LeadStatusFilter =
    | "PENDING_CONTACT"
    | "NEW"
    | "CONTACTED"
    | "RESOLVED"
    | "DROPPED"

export type LeadUrgencyFilter = "LOW" | "MED" | "HIGH"

const STATUS_VALUES: LeadStatusFilter[] = [
    "PENDING_CONTACT",
    "NEW",
    "CONTACTED",
    "RESOLVED",
    "DROPPED",
]

const URGENCY_VALUES: LeadUrgencyFilter[] = ["LOW", "MED", "HIGH"]

export type LeadFiltersState = {
    status: LeadStatusFilter | undefined
    urgency: LeadUrgencyFilter | undefined
    q: string
    page: number
    pageSize: number
}

export function parseLeadFilters(
    params: Record<string, string | undefined>,
): LeadFiltersState {
    const statusRaw = params.status?.trim()
    const status = STATUS_VALUES.includes(statusRaw as LeadStatusFilter)
        ? (statusRaw as LeadStatusFilter)
        : undefined

    const urgencyRaw = params.urgency?.trim()
    const urgency = URGENCY_VALUES.includes(urgencyRaw as LeadUrgencyFilter)
        ? (urgencyRaw as LeadUrgencyFilter)
        : undefined

    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20))

    return {
        status,
        urgency,
        q: (params.q ?? "").trim(),
        page,
        pageSize,
    }
}
