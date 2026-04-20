import { parseTemplate, resolveCardFields, type ResolvedCard } from "@/lib/card-format"

describe("parseTemplate", () => {
  it("parses template with ---- delimiter", () => {
    expect(parseTemplate("{账号}----{密码}----{生日}")).toEqual({
      delimiter: "----",
      fields: ["账号", "密码", "生日"],
    })
  })

  it("parses template with | delimiter", () => {
    expect(parseTemplate("{账号}|{密码}")).toEqual({
      delimiter: "|",
      fields: ["账号", "密码"],
    })
  })

  it("returns null for a single placeholder", () => {
    expect(parseTemplate("{账号}")).toBeNull()
  })

  it("returns null when placeholders are adjacent with no delimiter", () => {
    expect(parseTemplate("{账号}{密码}")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseTemplate("")).toBeNull()
  })
})

describe("resolveCardFields", () => {
  const twoFieldFormat = [{ template: "{账号}----{密码}" }]
  const sixFieldFormat = [
    { template: "{账号}----{密码}----{密保朋友}----{工作答案}----{父母答案}----{生日}" },
  ]
  const bothFormats = [...twoFieldFormat, ...sixFieldFormat]

  it("matches a 2-field card", () => {
    const result = resolveCardFields("user@example.com----pass123", twoFieldFormat)
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
      ],
    })
  })

  it("matches the correct format among multiple", () => {
    const content =
      "user@example.com----pass123----friend_ans----work_ans----parent_ans----1990-01-01"
    const result = resolveCardFields(content, bothFormats)
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
        { label: "密保朋友", value: "friend_ans" },
        { label: "工作答案", value: "work_ans" },
        { label: "父母答案", value: "parent_ans" },
        { label: "生日", value: "1990-01-01" },
      ],
    })
  })

  it("trims whitespace from field values", () => {
    const result = resolveCardFields(" user@example.com ---- pass123 ", twoFieldFormat)
    expect(result).toEqual<ResolvedCard>({
      type: "formatted",
      fields: [
        { label: "账号", value: "user@example.com" },
        { label: "密码", value: "pass123" },
      ],
    })
  })

  it("falls back to label heuristic for self-labeled content with no formats", () => {
    const result = resolveCardFields("账号user@a.com----密码pass123", [])
    expect(result.type).toBe("formatted")
    if (result.type === "formatted") {
      expect(result.fields).toContainEqual({ label: "账号", value: "user@a.com" })
      expect(result.fields).toContainEqual({ label: "密码", value: "pass123" })
    }
  })

  it("falls back to label heuristic when no format matches field count", () => {
    const result = resolveCardFields(
      "账号user@a.com----密码pass123----密保答案朋友答案abc",
      twoFieldFormat
    )
    expect(result.type).toBe("formatted")
  })

  it("returns plain text for unlabeled content with no matching format", () => {
    const result = resolveCardFields("XXXX-XXXX-XXXX-XXXX", [])
    expect(result).toEqual<ResolvedCard>({ type: "plain", content: "XXXX-XXXX-XXXX-XXXX" })
  })

  it("returns plain text for positional card with no matching format", () => {
    const result = resolveCardFields("part1----part2----part3", twoFieldFormat)
    expect(result).toEqual<ResolvedCard>({ type: "plain", content: "part1----part2----part3" })
  })
})
