import { NextResponse } from "next/server"

export type JsonErrorOptions = {
    details?: unknown
    code?: string
}

export type ErrorBody = {
    error: string
    details?: unknown
    code?: string
}

function errorBody(message: string, opts?: JsonErrorOptions): ErrorBody {
    const body: ErrorBody = { error: message }
    if (opts?.details !== undefined) body.details = opts.details
    if (opts?.code !== undefined) body.code = opts.code
    return body
}

const STATUS_DEFAULT_MESSAGE: Partial<Record<number, string>> = {
    400: "Bad request",
    401: "Unauthorized",
    404: "Not found",
    409: "Conflict",
    500: "Internal server error",
    503: "Service unavailable",
}

function withStatus(status: number) {
    return (message?: string, opts?: JsonErrorOptions): NextResponse => {
        const msg = message ?? STATUS_DEFAULT_MESSAGE[status] ?? "Error"
        return NextResponse.json(errorBody(msg, opts), { status })
    }
}

const _400 = withStatus(400)
const _401 = withStatus(401)
const _404 = withStatus(404)
const _409 = withStatus(409)
const _500 = withStatus(500)
const _503 = withStatus(503)

export function unauthorized(message?: string, opts?: JsonErrorOptions) {
    return _401(message, opts)
}
export function notFound(message?: string, opts?: JsonErrorOptions) {
    return _404(message, opts)
}
export function badRequest(message?: string, opts?: JsonErrorOptions) {
    return _400(message, opts)
}
export function conflict(message?: string, opts?: JsonErrorOptions) {
    return _409(message, opts)
}
export function internalServerError(message?: string, opts?: JsonErrorOptions) {
    return _500(message, opts)
}
export function serviceUnavailable(message?: string, opts?: JsonErrorOptions) {
    return _503(message, opts)
}

export function invalidJsonBody(message?: string) {
    return _400(message ?? "Invalid JSON body")
}
export function validationError(details?: unknown, message?: string) {
    return _400(message ?? "Validation failed", { details, code: "VALIDATION_FAILED" })
}
