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
    sessionId: string | undefined
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

    // sessionId filter — clicked from a "回头客 N 次" badge or from the
    // conversation detail page's "view all leads of this session" link.
    // ULID length is 26, allow 20-40 to match server-side validation.
    const sessionIdRaw = params.sessionId?.trim()
    const sessionId =
        sessionIdRaw && sessionIdRaw.length >= 20 && sessionIdRaw.length <= 40
            ? sessionIdRaw
            : undefined

    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20))

    return {
        status,
        urgency,
        sessionId,
        q: (params.q ?? "").trim(),
        page,
        pageSize,
    }
}
