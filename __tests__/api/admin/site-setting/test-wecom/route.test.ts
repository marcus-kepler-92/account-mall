import { POST } from "@/app/api/admin/site-setting/test-wecom/route"
import { getAdminSession } from "@/lib/auth-guard"
import { getSiteSettings } from "@/lib/site-settings"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/site-settings", () => ({ getSiteSettings: jest.fn() }))

const mockSession = { user: { id: "admin-1" } }

beforeEach(() => {
    jest.clearAllMocks()
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    ;(global.fetch as unknown) = jest.fn()
})

afterEach(() => {
    ;(global.fetch as unknown) = undefined
})

describe("POST /api/admin/site-setting/test-wecom", () => {
    it("returns 401 when not authenticated", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValue(null)
        const res = await POST()
        expect(res.status).toBe(401)
    })

    it("returns 400 when wecomWebhookUrl is not configured", async () => {
        ;(getSiteSettings as jest.Mock).mockResolvedValue({ wecomWebhookUrl: undefined })
        const res = await POST()
        expect(res.status).toBe(400)
    })

    it("posts markdown payload to the configured webhook and returns ok", async () => {
        const url = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc"
        ;(getSiteSettings as jest.Mock).mockResolvedValue({ wecomWebhookUrl: url })
        ;(global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ errcode: 0, errmsg: "ok" }),
        })

        const res = await POST()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.ok).toBe(true)

        expect(global.fetch).toHaveBeenCalledTimes(1)
        const [calledUrl, init] = (global.fetch as jest.Mock).mock.calls[0]
        expect(calledUrl).toBe(url)
        expect(init.method).toBe("POST")
        expect(init.headers["Content-Type"]).toBe("application/json")
        const sent = JSON.parse(init.body)
        expect(sent.msgtype).toBe("markdown")
        expect(sent.markdown.content).toContain("测试消息")
    })

    it("returns 502 when WeCom responds with non-zero errcode", async () => {
        ;(getSiteSettings as jest.Mock).mockResolvedValue({
            wecomWebhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc",
        })
        ;(global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ errcode: 93000, errmsg: "invalid webhook url" }),
        })

        const res = await POST()
        expect(res.status).toBe(502)
        const body = await res.json()
        expect(body.ok).toBe(false)
        expect(body.error).toContain("invalid")
    })

    it("returns 502 when fetch throws", async () => {
        ;(getSiteSettings as jest.Mock).mockResolvedValue({
            wecomWebhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc",
        })
        ;(global.fetch as jest.Mock).mockRejectedValue(new Error("network down"))

        const res = await POST()
        expect(res.status).toBe(502)
        const body = await res.json()
        expect(body.ok).toBe(false)
        expect(body.error).toBe("network down")
    })
})
