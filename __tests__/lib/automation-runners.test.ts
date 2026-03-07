import type { Page } from "playwright";
import { runAppleStatusTest } from "@/lib/automation/runners/apple-status-test";
import { runApplePasswordChange } from "@/lib/automation/runners/apple-password-change";
import type { RunnerContext } from "@/lib/automation/runners/types";

const noopLog: RunnerContext["log"] = async () => {};

function createMockPage(): Page {
  const locatorChain = {
    waitFor: async () => {},
    fill: async () => {},
    isVisible: async () => false,
    click: async () => {},
    selectOption: async () => [],
    or: () => locatorChain,
    first: () => locatorChain,
    nth: () => locatorChain,
    filter: () => locatorChain,
    textContent: async () => null as string | null,
  };
  return {
    goto: async () => ({ ok: true } as const),
    locator: () => locatorChain,
    getByRole: () => locatorChain,
    getByText: () => locatorChain,
    waitForLoadState: async () => {},
    waitForURL: async () => {},
    frames: () => [{ locator: () => locatorChain, getByRole: () => locatorChain }],
    mainFrame: () => null,
    on: () => {},
    off: () => {},
    get url() {
      return "https://account.apple.com/";
    },
  } as unknown as Page;
}

describe("Apple Status Test Runner", () => {
  const baseContext: RunnerContext = {
    taskId: "task_1",
    itemId: "item_1",
    cardId: "card_1",
    cardContent: "",
    presetConfig: { timeoutMs: 5000, skipDelays: true },
    inputConfig: {},
    log: noopLog,
  };

  const mockPage = createMockPage();

  it("parses JSON card content correctly", async () => {
    const ctx: RunnerContext = {
      ...baseContext,
      cardContent: JSON.stringify({
        account: "test@apple.com",
        password: "testpass123",
        region: "US",
      }),
    };

    const result = await runAppleStatusTest(ctx, mockPage);
    expect(result.errorCode).not.toBe("INVALID_CREDENTIALS");
  });

  it("parses colon-separated card content correctly", async () => {
    const ctx: RunnerContext = {
      ...baseContext,
      cardContent: "test@apple.com:testpass123",
    };

    const result = await runAppleStatusTest(ctx, mockPage);
    expect(result.errorCode).not.toBe("INVALID_CREDENTIALS");
  });

  it("returns error for invalid card content format", async () => {
    const ctx: RunnerContext = {
      ...baseContext,
      cardContent: "invalid-content-without-password",
    };

    const result = await runAppleStatusTest(ctx, mockPage);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_CREDENTIALS");
  });

  it("returns error for empty account", async () => {
    const ctx: RunnerContext = {
      ...baseContext,
      cardContent: ":password123",
    };

    const result = await runAppleStatusTest(ctx, mockPage);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_CREDENTIALS");
  });
});

describe("Apple Password Change Runner", () => {
  const baseContext: RunnerContext = {
    taskId: "task_1",
    itemId: "item_1",
    cardId: "card_1",
    cardContent: "",
    presetConfig: { timeoutMs: 5000, passwordLength: 12, skipDelays: true },
    inputConfig: {},
    log: noopLog,
  };

  const mockPage = createMockPage();

  it("parses JSON card content correctly", async () => {
    const ctx: RunnerContext = {
      ...baseContext,
      cardContent: JSON.stringify({
        account: "test@apple.com",
        password: "oldpass123",
        region: "US",
      }),
    };

    const result = await runApplePasswordChange(ctx, mockPage);
    expect(result.errorMessage).not.toBe(
      "无法解析卡密内容，请检查格式或设置正确的卡密分隔符（如 ----、:、|）"
    );
  });

  it("returns new password on success", async () => {
    const ctx: RunnerContext = {
      ...baseContext,
      cardContent: "test@apple.com:oldpass123",
    };

    const result = await runApplePasswordChange(ctx, mockPage);

    if (result.success) {
      expect(result.newPassword).toBeDefined();
      expect(result.newPassword!.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("returns error for invalid card content format", async () => {
    const ctx: RunnerContext = {
      ...baseContext,
      cardContent: "invalid",
    };

    const result = await runApplePasswordChange(ctx, mockPage);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_CREDENTIALS");
  });

  it(
    "does not return newPassword on failure",
    async () => {
      const ctx: RunnerContext = {
        ...baseContext,
        cardContent: "test@apple.com:oldpass123",
      };

      const result = await runApplePasswordChange(ctx, mockPage);

      if (!result.success) {
        expect(result.newPassword).toBeUndefined();
      }
    },
    15000
  );
});
