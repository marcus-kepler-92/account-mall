import { type NextRequest } from "next/server";
import { POST, GET } from "@/app/api/automation/tasks/route";
import { prismaMock } from "../../__mocks__/prisma";

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma");
  return {
    __esModule: true,
    prisma: prismaMock,
  };
});

jest.mock("@/lib/auth-guard", () => ({
  __esModule: true,
  getAdminSession: jest.fn(),
}));

import { getAdminSession } from "@/lib/auth-guard";

function createRequest(
  method: string,
  body?: Record<string, unknown>,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL("http://localhost/api/automation/tasks");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  return new Request(url.toString(), {
    method,
    ...(body && {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  }) as NextRequest;
}

describe("POST /api/automation/tasks", () => {
  const adminSessionMock = getAdminSession as jest.Mock;

  beforeEach(() => {
    adminSessionMock.mockReset();
    prismaMock.productAutomationPreset.findUnique.mockReset();
    prismaMock.card.findMany.mockReset();
    prismaMock.automationTask.create.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null);

    const res = await POST(
      createRequest("POST", {
        productId: "prod_1",
        presetId: "preset_1",
        cardIds: ["card_1"],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid body", async () => {
    adminSessionMock.mockResolvedValueOnce({ user: { id: "admin_1", email: "admin@test.com" } });

    const res = await POST(createRequest("POST", { productId: "prod_1" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("returns 404 when preset not found", async () => {
    adminSessionMock.mockResolvedValueOnce({ user: { id: "admin_1", email: "admin@test.com" } });
    prismaMock.productAutomationPreset.findUnique.mockResolvedValueOnce(null);

    const res = await POST(
      createRequest("POST", {
        productId: "prod_1",
        presetId: "preset_1",
        cardIds: ["card_1"],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Preset not found");
  });

  it("returns 400 when preset category is not APPLE", async () => {
    adminSessionMock.mockResolvedValueOnce({ user: { id: "admin_1", email: "admin@test.com" } });
    prismaMock.productAutomationPreset.findUnique.mockResolvedValueOnce({
      id: "preset_1",
      productId: "prod_1",
      category: "GOOGLE",
      isEnabled: true,
      presetKey: "test",
    } as any);

    const res = await POST(
      createRequest("POST", {
        productId: "prod_1",
        presetId: "preset_1",
        cardIds: ["card_1"],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Only Apple category is supported");
  });

  it("returns 400 when preset is disabled", async () => {
    adminSessionMock.mockResolvedValueOnce({ user: { id: "admin_1", email: "admin@test.com" } });
    prismaMock.productAutomationPreset.findUnique.mockResolvedValueOnce({
      id: "preset_1",
      productId: "prod_1",
      category: "APPLE",
      isEnabled: false,
      presetKey: "test",
    } as any);

    const res = await POST(
      createRequest("POST", {
        productId: "prod_1",
        presetId: "preset_1",
        cardIds: ["card_1"],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Preset is disabled");
  });

  it("returns 400 when preset does not belong to product", async () => {
    adminSessionMock.mockResolvedValueOnce({ user: { id: "admin_1", email: "admin@test.com" } });
    prismaMock.productAutomationPreset.findUnique.mockResolvedValueOnce({
      id: "preset_1",
      productId: "prod_2",
      category: "APPLE",
      isEnabled: true,
      presetKey: "test",
    } as any);

    const res = await POST(
      createRequest("POST", {
        productId: "prod_1",
        presetId: "preset_1",
        cardIds: ["card_1"],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Preset does not belong to this product");
  });

  it("creates task successfully with valid APPLE preset", async () => {
    adminSessionMock.mockResolvedValueOnce({ user: { id: "admin_1", email: "admin@test.com" } });
    prismaMock.productAutomationPreset.findUnique.mockResolvedValueOnce({
      id: "preset_1",
      productId: "prod_1",
      category: "APPLE",
      isEnabled: true,
      presetKey: "status_test_basic",
    } as any);
    prismaMock.card.findMany.mockResolvedValueOnce([
      { id: "card_1" },
      { id: "card_2" },
    ] as any);
    prismaMock.automationTask.create.mockResolvedValueOnce({
      id: "task_1",
      status: "PENDING",
      preset: { name: "Apple 状态测试", presetKey: "status_test_basic" },
      _count: { items: 2 },
    } as any);

    const res = await POST(
      createRequest("POST", {
        productId: "prod_1",
        presetId: "preset_1",
        cardIds: ["card_1", "card_2", "card_3"],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("task_1");
    expect(data.itemCount).toBe(2);
    expect(data.skipped).toBe(1);
  });

  it("rejects when cardIds exceeds 100", async () => {
    adminSessionMock.mockResolvedValueOnce({ user: { id: "admin_1", email: "admin@test.com" } });

    const cardIds = Array.from({ length: 101 }, (_, i) => `card_${i}`);
    const res = await POST(
      createRequest("POST", {
        productId: "prod_1",
        presetId: "preset_1",
        cardIds,
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});

describe("GET /api/automation/tasks", () => {
  const adminSessionMock = getAdminSession as jest.Mock;

  beforeEach(() => {
    adminSessionMock.mockReset();
    prismaMock.automationTask.findMany.mockReset();
    prismaMock.automationTask.count.mockReset();
    prismaMock.automationTaskItem.groupBy.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null);

    const res = await GET(createRequest("GET"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns tasks list with APPLE category filter", async () => {
    adminSessionMock.mockResolvedValueOnce({ user: { id: "admin_1" } });
    prismaMock.automationTask.findMany.mockResolvedValueOnce([
      {
        id: "task_1",
        category: "APPLE",
        status: "PENDING",
        createdBy: "admin@test.com",
        summary: null,
        createdAt: new Date(),
        product: { id: "prod_1", name: "Test Product" },
        preset: { id: "preset_1", name: "Apple 状态测试", presetKey: "status_test_basic", presetType: "STATUS_TEST" },
        _count: { items: 5 },
      },
    ] as any);
    prismaMock.automationTask.count.mockResolvedValueOnce(1);
    prismaMock.automationTaskItem.groupBy.mockResolvedValueOnce([
      { taskId: "task_1", status: "PENDING", _count: { id: 3 } },
      { taskId: "task_1", status: "SUCCESS", _count: { id: 2 } },
    ] as any);

    const res = await GET(createRequest("GET"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].category).toBe("APPLE");
  });
});
