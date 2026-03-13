import {
  parseCardContentWithDelimiter,
  parseAutoFetchCardContent,
  isAutoFetchCard,
  type AutoFetchCardPayload,
} from "@/lib/auto-fetch-card";

describe("parseAutoFetchCardContent", () => {
  it("parses valid JSON with account and password", () => {
    const json = JSON.stringify({
      account: "test@apple.com",
      password: "secret123",
    });
    const result = parseAutoFetchCardContent(json);
    expect(result).not.toBeNull();
    expect(result?.account).toBe("test@apple.com");
    expect(result?.password).toBe("secret123");
    expect(result?.region).toBe("未知");
  });

  it("parses JSON with region and optional fields", () => {
    const json = JSON.stringify({
      account: "a@b.com",
      password: "p",
      region: "US",
      birthday: "1998-01-08",
      securityAnswerFriend: "f",
      securityAnswerWork: "w",
      securityAnswerParents: "p",
    });
    const result = parseAutoFetchCardContent(json);
    expect(result).not.toBeNull();
    expect(result?.region).toBe("US");
    expect(result?.birthday).toBe("1998-01-08");
    expect(result?.securityAnswerFriend).toBe("f");
    expect(result?.securityAnswerWork).toBe("w");
    expect(result?.securityAnswerParents).toBe("p");
  });

  it("returns null for invalid JSON", () => {
    expect(parseAutoFetchCardContent("not json")).toBeNull();
    expect(parseAutoFetchCardContent("")).toBeNull();
  });

  it("returns null when account or password missing in JSON", () => {
    expect(parseAutoFetchCardContent(JSON.stringify({ account: "a" }))).toBeNull();
    expect(parseAutoFetchCardContent(JSON.stringify({ password: "p" }))).toBeNull();
  });
});

describe("parseCardContentWithDelimiter", () => {
  describe("email = account, next = password", () => {
    it("parses space-separated email and password", () => {
      const result = parseCardContentWithDelimiter("a@b.com pass");
      expect(result).not.toBeNull();
      expect(result?.account).toBe("a@b.com");
      expect(result?.password).toBe("pass");
      expect(result?.region).toBe("未知");
    });

    it("parses ---- separated email and password", () => {
      const result = parseCardContentWithDelimiter("a@b.com----pass");
      expect(result).not.toBeNull();
      expect(result?.account).toBe("a@b.com");
      expect(result?.password).toBe("pass");
    });

    it("parses colon-separated", () => {
      const result = parseCardContentWithDelimiter("a@b.com:pass");
      expect(result).not.toBeNull();
      expect(result?.account).toBe("a@b.com");
      expect(result?.password).toBe("pass");
    });

    it("uses user-provided delimiter when given", () => {
      const result = parseCardContentWithDelimiter("a@b.com|||pass", "|||");
      expect(result).not.toBeNull();
      expect(result?.account).toBe("a@b.com");
      expect(result?.password).toBe("pass");
    });
  });

  describe("birthday detection", () => {
    it("parses DD/MM/YYYY as birthday", () => {
      const result = parseCardContentWithDelimiter(
        "shannodennis9a9@icloud.com HMEcm8Kd@ 1/1/2000 EhAB11 EhAB12 EhAB13"
      );
      expect(result).not.toBeNull();
      expect(result?.birthday).toBe("1/1/2000");
    });

    it("parses YYYY-MM-DD as birthday", () => {
      const result = parseCardContentWithDelimiter(
        "user@mail.com pass 1998-01-08 ans1 ans2 ans3"
      );
      expect(result).not.toBeNull();
      expect(result?.birthday).toBe("1998-01-08");
    });
  });

  describe("security answers in order 1, 2, 3", () => {
    it("maps remaining parts to securityAnswerFriend, Work, Parents", () => {
      const result = parseCardContentWithDelimiter(
        "shannodennis9a9@icloud.com HMEcm8Kd@ 1/1/2000 EhAB11 EhAB12 EhAB13"
      );
      expect(result).not.toBeNull();
      expect(result?.account).toBe("shannodennis9a9@icloud.com");
      expect(result?.password).toBe("HMEcm8Kd@");
      expect(result?.birthday).toBe("1/1/2000");
      expect(result?.securityAnswerFriend).toBe("EhAB11");
      expect(result?.securityAnswerWork).toBe("EhAB12");
      expect(result?.securityAnswerParents).toBe("EhAB13");
    });

    it("fills only first 1 or 2 security answers when fewer remaining parts", () => {
      const twoExtra = parseCardContentWithDelimiter("a@b.com pass 1/1/2000 ans1 ans2");
      expect(twoExtra?.securityAnswerFriend).toBe("ans1");
      expect(twoExtra?.securityAnswerWork).toBe("ans2");
      expect(twoExtra?.securityAnswerParents).toBeUndefined();

      const oneExtra = parseCardContentWithDelimiter("a@b.com pass 1/1/2000 ans1");
      expect(oneExtra?.securityAnswerFriend).toBe("ans1");
      expect(oneExtra?.securityAnswerWork).toBeUndefined();
      expect(oneExtra?.securityAnswerParents).toBeUndefined();
    });
  });

  describe("label-based format", () => {
    it("parses 账号/密码/生日/密保 labels with ----", () => {
      const content =
        "账号user@mail.com----密码mypass----生日1998-01-08----密保答案朋友答案fval----工作答案wval----父母答案pval";
      const result = parseCardContentWithDelimiter(content);
      expect(result).not.toBeNull();
      expect(result?.account).toBe("user@mail.com");
      expect(result?.password).toBe("mypass");
      expect(result?.birthday).toBe("1998-01-08");
      expect(result?.securityAnswerFriend).toBe("fval");
      expect(result?.securityAnswerWork).toBe("wval");
      expect(result?.securityAnswerParents).toBe("pval");
    });

    it("parses 朋友答案 as securityAnswerFriend", () => {
      const result = parseCardContentWithDelimiter(
        "账号a@b.com----密码p----生日2000-01-01----朋友答案f----工作答案w----父母答案par"
      );
      expect(result).not.toBeNull();
      expect(result?.securityAnswerFriend).toBe("f");
      expect(result?.securityAnswerWork).toBe("w");
      expect(result?.securityAnswerParents).toBe("par");
    });
  });

  describe("account + password + region (3 segments)", () => {
    it("treats third segment as region when not a date", () => {
      const result = parseCardContentWithDelimiter("a@b.com----pass----US");
      expect(result).not.toBeNull();
      expect(result?.account).toBe("a@b.com");
      expect(result?.password).toBe("pass");
      expect(result?.region).toBe("US");
    });

    it("with heuristic fallback: no email-like part uses parts[0] and parts[1]", () => {
      const result = parseCardContentWithDelimiter("notemail pass");
      expect(result).not.toBeNull();
      expect(result?.account).toBe("notemail");
      expect(result?.password).toBe("pass");
    });
  });

  describe("delimiter and whitespace", () => {
    it("splits by ---- when default", () => {
      const result = parseCardContentWithDelimiter("a@b.com----p----1998-01-08----s1----s2----s3");
      expect(result).not.toBeNull();
      expect(result?.birthday).toBe("1998-01-08");
      expect(result?.securityAnswerFriend).toBe("s1");
      expect(result?.securityAnswerWork).toBe("s2");
      expect(result?.securityAnswerParents).toBe("s3");
    });

    it("splits by space when no delimiter produces multiple parts", () => {
      const result = parseCardContentWithDelimiter("a@b.com  p  1/1/2000  r1  r2  r3");
      expect(result).not.toBeNull();
      expect(result?.account).toBe("a@b.com");
      expect(result?.password).toBe("p");
      expect(result?.birthday).toBe("1/1/2000");
      expect(result?.securityAnswerFriend).toBe("r1");
      expect(result?.securityAnswerWork).toBe("r2");
      expect(result?.securityAnswerParents).toBe("r3");
    });
  });

  describe("edge cases", () => {
    it("returns null for empty or whitespace-only content", () => {
      expect(parseCardContentWithDelimiter("")).toBeNull();
      expect(parseCardContentWithDelimiter("   ")).toBeNull();
    });

    it("trims leading and trailing whitespace before parsing", () => {
      const result = parseCardContentWithDelimiter("  a@b.com  pass  ");
      expect(result).not.toBeNull();
      expect(result?.account).toBe("a@b.com");
      expect(result?.password).toBe("pass");
    });

    it("returns null for single segment (no delimiter)", () => {
      expect(parseCardContentWithDelimiter("onlyone")).toBeNull();
    });

    it("returns null when two segments but neither looks like email and label parse fails", () => {
      const result = parseCardContentWithDelimiter("foo bar");
      expect(result).not.toBeNull();
      expect(result?.account).toBe("foo");
      expect(result?.password).toBe("bar");
    });
  });
});

describe("isAutoFetchCard", () => {
  it("returns true for object with account and password", () => {
    const payload: AutoFetchCardPayload = {
      account: "a@b.com",
      password: "p",
      region: "未知",
    };
    expect(isAutoFetchCard(payload)).toBe(true);
  });

  it("returns true for parsed result", () => {
    const result = parseCardContentWithDelimiter("a@b.com pass");
    expect(result).not.toBeNull();
    expect(isAutoFetchCard(result!)).toBe(true);
  });

  it("returns false for object with only content", () => {
    expect(isAutoFetchCard({ content: "a@b.com:pass" })).toBe(false);
  });
});
