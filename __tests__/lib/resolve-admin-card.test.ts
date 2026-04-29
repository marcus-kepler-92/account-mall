import { resolveAdminCard } from "@/lib/card-format"
import type { ResolvedCard } from "@/lib/card-format"

describe("resolveAdminCard", () => {
  it("maps AUTO_FETCH JSON to formatted fields (account/password/region)", () => {
    const content = JSON.stringify({
      account: "user@example.com",
      password: "pass123",
      region: "US",
    })
    const result = resolveAdminCard(content, [])
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
        { label: "地区", value: "US" },
      ],
    })
  })

  it("includes optional AUTO_FETCH fields when present", () => {
    const content = JSON.stringify({
      account: "user@example.com",
      password: "pass123",
      region: "US",
      birthday: "1990-01-01",
      securityAnswerFriend: "buddy",
      securityAnswerWork: "company",
      securityAnswerParents: "hometown",
    })
    const result = resolveAdminCard(content, [])
    expect(result.type).toBe("formatted")
    if (result.type === "formatted") {
      expect(result.fields).toContainEqual({ label: "生日", value: "1990-01-01" })
      expect(result.fields).toContainEqual({ label: "密保朋友", value: "buddy" })
      expect(result.fields).toContainEqual({ label: "工作答案", value: "company" })
      expect(result.fields).toContainEqual({ label: "父母答案", value: "hometown" })
    }
  })

  it("falls back to template matching for regular cards", () => {
    const content = "user@example.com----pass123"
    const templates = [{ template: "{账号}----{密码}" }]
    const result = resolveAdminCard(content, templates)
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
      ],
    })
  })

  it("returns plain for unstructured content with no matching template", () => {
    const result = resolveAdminCard("XXXX-XXXX-XXXX-XXXX", [])
    expect(result).toEqual<ResolvedCard>({ type: "plain", content: "XXXX-XXXX-XXXX-XXXX" })
  })
})
