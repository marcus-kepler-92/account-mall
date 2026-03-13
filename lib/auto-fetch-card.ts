/**
 * AUTO_FETCH 卡密：单一数据源类型与序列化/反序列化。
 * Card.content 存此处定义的 payload JSON；API 返回与前端展示共用此形状。
 */

import type { SharedAccount } from "@/lib/scrape-shared-accounts"

/** 前端/API 用的卡密 payload（不含 status，不对外展示） */
export interface AutoFetchCardPayload {
    account: string
    password: string
    region: string
    lastCheckedAt?: string
    installStatus?: string
    /** 生日，如 1/1/2000、1998-01-08 */
    birthday?: string
    /** 密保答案 1（如朋友答案） */
    securityAnswerFriend?: string
    /** 密保答案 2（如工作答案） */
    securityAnswerWork?: string
    /** 密保答案 3（如父母答案） */
    securityAnswerParents?: string
}

/** 向后兼容别名 */
export type FreeSharedCardPayload = AutoFetchCardPayload

/** 从爬虫结果转为卡密 payload（去掉 status） */
export function sharedAccountToCardPayload(account: SharedAccount): AutoFetchCardPayload {
    return {
        account: account.account,
        password: account.password,
        region: account.region,
        ...(account.lastCheckedAt && { lastCheckedAt: account.lastCheckedAt }),
        ...(account.installStatus && { installStatus: account.installStatus }),
    }
}

/** 序列化为 Card.content 的 JSON 字符串（存库用） */
export function toCardContentJson(payload: AutoFetchCardPayload): string {
    return JSON.stringify(payload)
}

/** 将 AUTO_FETCH 卡密 payload 格式化为可读文本（复制/展示用，仅账号密码，无 label） */
export function formatAutoFetchCardForCopy(payload: AutoFetchCardPayload): string {
    return `${payload.account}\n${payload.password}`
}

/** 向后兼容别名 */
export const formatFreeSharedCardForCopy = formatAutoFetchCardForCopy

/** 解析 Card.content：若为 AUTO_FETCH JSON 则返回 payload，否则返回 null */
export function parseAutoFetchCardContent(content: string): AutoFetchCardPayload | null {
    try {
        const parsed = JSON.parse(content) as unknown
        if (
            parsed &&
            typeof parsed === "object" &&
            "account" in parsed &&
            "password" in parsed &&
            typeof (parsed as { account: unknown }).account === "string" &&
            typeof (parsed as { password: unknown }).password === "string"
        ) {
            const p = parsed as {
                account: string
                password: string
                region?: string
                lastCheckedAt?: string
                installStatus?: string
                birthday?: string
                securityAnswerFriend?: string
                securityAnswerWork?: string
                securityAnswerParents?: string
            }
            return {
                account: p.account,
                password: p.password,
                region: p.region ?? "未知",
                ...(p.lastCheckedAt && { lastCheckedAt: p.lastCheckedAt }),
                ...(p.installStatus && { installStatus: p.installStatus }),
                ...(p.birthday && { birthday: p.birthday }),
                ...(p.securityAnswerFriend && { securityAnswerFriend: p.securityAnswerFriend }),
                ...(p.securityAnswerWork && { securityAnswerWork: p.securityAnswerWork }),
                ...(p.securityAnswerParents && { securityAnswerParents: p.securityAnswerParents }),
            }
        }
    } catch {
        /* not JSON or invalid */
    }
    return null
}

/** 向后兼容别名 */
export const parseFreeSharedCardContent = parseAutoFetchCardContent

const FALLBACK_DELIMITERS = ["----", ":", "|"] as const

/**
 * 卡密内容的第一段（用于执行明细等展示），与 parseCardContentWithDelimiter / 测试账号解析逻辑一致。
 * 若能用相同逻辑解析出 payload 则取 account；否则按相同分隔符顺序切分，取第一个元素；无则整条截断至 80 字。
 * @param content 原始卡密字符串
 * @param delimiter 任务配置的分隔符（与 inputConfig.contentDelimiter 一致），留空则用 FALLBACK_DELIMITERS
 */
export function getCardContentFirstSegment(
  content: string,
  delimiter?: string | null
): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;
  const parsed = parseCardContentWithDelimiter(trimmed, delimiter);
  if (parsed) return parsed.account;
  const delimitersToTry: string[] =
    delimiter != null && delimiter !== "" ? [delimiter] : [...FALLBACK_DELIMITERS];
  for (const sep of delimitersToTry) {
    const parts = trimmed.split(sep).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[0];
  }
  const bySpace = trimmed.split(/\s+/).filter(Boolean);
  if (bySpace.length >= 2) return bySpace[0];
  return trimmed.length > 80 ? trimmed.slice(0, 80) : trimmed;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+$/
const DATE_REGEX = /^\d{1,2}\/\d{1,2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$/

/** 带标签解析：前缀 -> payload 字段，按长度降序避免短前缀误匹配 */
const LABEL_PREFIXES: [string, keyof Pick<AutoFetchCardPayload, "account" | "password" | "region" | "birthday" | "securityAnswerFriend" | "securityAnswerWork" | "securityAnswerParents">][] = [
    ["密保答案朋友答案", "securityAnswerFriend"],
    ["朋友答案", "securityAnswerFriend"],
    ["工作答案", "securityAnswerWork"],
    ["父母答案", "securityAnswerParents"],
    ["账号", "account"],
    ["密码", "password"],
    ["生日", "birthday"],
    ["account", "account"],
    ["password", "password"],
    ["birthday", "birthday"],
]

function parseByLabel(parts: string[]): AutoFetchCardPayload | null {
    const acc: Partial<AutoFetchCardPayload> = { region: "未知" }
    for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed) continue
        for (const [prefix, key] of LABEL_PREFIXES) {
            if (trimmed.startsWith(prefix)) {
                const value = trimmed.slice(prefix.length).trim()
                if (value) (acc as Record<string, string>)[key] = value
                break
            }
        }
    }
    if (typeof acc.account === "string" && typeof acc.password === "string") {
        return {
            account: acc.account,
            password: acc.password,
            region: acc.region ?? "未知",
            ...(acc.birthday && { birthday: acc.birthday }),
            ...(acc.securityAnswerFriend && { securityAnswerFriend: acc.securityAnswerFriend }),
            ...(acc.securityAnswerWork && { securityAnswerWork: acc.securityAnswerWork }),
            ...(acc.securityAnswerParents && { securityAnswerParents: acc.securityAnswerParents }),
        }
    }
    return null
}

function parseByHeuristic(parts: string[]): AutoFetchCardPayload | null {
    if (parts.length < 2) return null
    let account: string | null = null
    let password: string | null = null
    let region = "未知"
    let birthday: string | null = null
    const usedIndices = new Set<number>()

    const emailIndex = parts.findIndex((p) => EMAIL_REGEX.test(p.trim()))
    if (emailIndex >= 0 && parts[emailIndex]) {
        account = parts[emailIndex].trim()
        usedIndices.add(emailIndex)
        if (emailIndex + 1 < parts.length && parts[emailIndex + 1]) {
            password = parts[emailIndex + 1].trim()
            usedIndices.add(emailIndex + 1)
        }
    }
    if (!account || !password) {
        account = parts[0]?.trim() ?? null
        password = parts[1]?.trim() ?? null
        usedIndices.add(0)
        usedIndices.add(1)
    }

    const dateIndex = parts.findIndex((p) => DATE_REGEX.test(p.trim()))
    if (dateIndex >= 0 && parts[dateIndex]) {
        birthday = parts[dateIndex].trim()
        usedIndices.add(dateIndex)
    }

    const thirdPart = parts[2]?.trim()
    if (thirdPart && !usedIndices.has(2) && !DATE_REGEX.test(thirdPart)) {
        region = thirdPart
        usedIndices.add(2)
    }

    const remaining = parts
        .map((p, i) => (usedIndices.has(i) ? null : p.trim()))
        .filter((p): p is string => Boolean(p))
    const [securityAnswerFriend, securityAnswerWork, securityAnswerParents] = remaining

    return {
        account: account ?? "",
        password: password ?? "",
        region,
        ...(birthday && { birthday }),
        ...(securityAnswerFriend && { securityAnswerFriend }),
        ...(securityAnswerWork && { securityAnswerWork }),
        ...(securityAnswerParents && { securityAnswerParents }),
    }
}

/**
 * 按分隔符解析卡密内容，提取 account、password、生日、密保等。
 * 规则：邮箱=账号、紧接着=密码、数字/日期=生日、其余按顺序=密保1/2/3；也支持带「账号」「密码」等标签的格式。
 * @param content 原始卡密字符串
 * @param delimiter 用户指定的分隔符（可选），如 "----"；留空则先试 JSON，再依次尝试 ----、:、|、空白
 */
export function parseCardContentWithDelimiter(
    content: string,
    delimiter?: string | null
): AutoFetchCardPayload | null {
    const trimmed = content.trim()
    if (!trimmed) return null

    const json = parseAutoFetchCardContent(trimmed)
    if (json) return json

    const delimitersToTry: string[] =
        delimiter != null && delimiter !== ""
            ? [delimiter]
            : [...FALLBACK_DELIMITERS]

    let parts: string[] = []
    for (const sep of delimitersToTry) {
        const p = trimmed.split(sep).map((s) => s.trim()).filter(Boolean)
        if (p.length >= 2) {
            parts = p
            break
        }
    }
    if (parts.length < 2) {
        parts = trimmed.split(/\s+/).filter(Boolean)
    }
    if (parts.length < 2) return null

    const byLabel = parseByLabel(parts)
    if (byLabel) return byLabel
    const byHeuristic = parseByHeuristic(parts)
    if (byHeuristic && byHeuristic.account && byHeuristic.password) return byHeuristic

    return null
}

/** 类型守卫：卡密项是否为 AUTO_FETCH（含 account/password） */
export function isAutoFetchCard(
    card: { content: string } | AutoFetchCardPayload
): card is AutoFetchCardPayload & { content?: string } {
    return "account" in card && "password" in card
}

/** 向后兼容别名 */
export const isFreeSharedCard = isAutoFetchCard
