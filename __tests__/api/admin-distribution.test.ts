import { type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import {
  GET as TiersGet,
  POST as TiersPost,
} from "@/app/api/admin/commission-tiers/route";
import {
  PATCH as TierPatch,
  DELETE as TierDelete,
} from "@/app/api/admin/commission-tiers/[id]/route";
import { GET as DistributorsGet } from "@/app/api/admin/distributors/route";
import {
  PATCH as DistributorPatch,
  DELETE as DistributorDelete,
} from "@/app/api/admin/distributors/[id]/route";
import { GET as WithdrawalsGet } from "@/app/api/admin/withdrawals/route";
import { PATCH as WithdrawalPatch } from "@/app/api/admin/withdrawals/[id]/route";
import { prismaMock } from "../../__mocks__/prisma";

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma");
  return { __esModule: true, prisma: prismaMock };
});

jest.mock("@/lib/auth-guard", () => ({
  __esModule: true,
  getAdminSession: jest.fn(),
}));

jest.mock("@/lib/domains/distributors", () => {
  // Define error classes inside the mock factory
  class DistributorNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DistributorNotFoundError";
    }
  }

  class DistributorNotDisabledError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DistributorNotDisabledError";
    }
  }

  class DistributorHasAssociationsError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DistributorHasAssociationsError";
    }
  }

  class NoCredentialAccountError extends Error {
    constructor() {
      super("该分销员没有密码凭证");
      this.name = "NoCredentialAccountError";
    }
  }

  return {
    ...jest.requireActual("@/lib/domains/distributors"),
    listDistributors: jest.fn(),
    updateDistributor: jest.fn(),
    deleteDistributor: jest.fn(),
    resetDistributorPassword: jest.fn(),
    DistributorNotFoundError,
    DistributorNotDisabledError,
    DistributorHasAssociationsError,
    NoCredentialAccountError,
  };
});

const getAdminSession = require("@/lib/auth-guard")
  .getAdminSession as jest.Mock;

const mockDistributorModule = require("@/lib/domains/distributors");
const listDistributors = mockDistributorModule.listDistributors;
const updateDistributor = mockDistributorModule.updateDistributor;
const deleteDistributor = mockDistributorModule.deleteDistributor;
const resetDistributorPassword = mockDistributorModule.resetDistributorPassword;
const DistributorNotFoundError = mockDistributorModule.DistributorNotFoundError;
const DistributorNotDisabledError = mockDistributorModule.DistributorNotDisabledError;
const DistributorHasAssociationsError = mockDistributorModule.DistributorHasAssociationsError;
const NoCredentialAccountError = mockDistributorModule.NoCredentialAccountError;

function withSession() {
  getAdminSession.mockResolvedValue({ user: { id: "admin_1" } });
}

describe("GET /api/admin/commission-tiers", () => {
  beforeEach(() => getAdminSession.mockReset());

  it("returns 401 when no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const res = await TiersGet();
    expect(res.status).toBe(401);
  });

  it("returns 200 with tiers array ordered by sortOrder", async () => {
    withSession();
    prismaMock.commissionTier.findMany.mockResolvedValue([
      {
        id: "t1",
        minAmount: new Prisma.Decimal("0"),
        maxAmount: new Prisma.Decimal("1000"),
        ratePercent: new Prisma.Decimal("5"),
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const res = await TiersGet();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toMatchObject({
      id: "t1",
      minAmount: 0,
      maxAmount: 1000,
      ratePercent: 5,
      sortOrder: 0,
    });
    expect(prismaMock.commissionTier.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
    });
  });
});

describe("POST /api/admin/commission-tiers", () => {
  beforeEach(() => getAdminSession.mockReset());

  it("returns 401 when no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const req = {
      json: async () => ({ minAmount: 0, maxAmount: 1000, ratePercent: 5 }),
    } as unknown as NextRequest;
    const res = await TiersPost(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when minAmount >= maxAmount", async () => {
    withSession();
    const req = {
      json: async () => ({ minAmount: 1000, maxAmount: 500, ratePercent: 5 }),
    } as unknown as NextRequest;
    const res = await TiersPost(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/minAmount|maxAmount/);
  });

  it("returns 400 when minAmount or maxAmount is negative", async () => {
    withSession();
    const req = {
      json: async () => ({ minAmount: -1, maxAmount: 1000, ratePercent: 5 }),
    } as unknown as NextRequest;
    const res = await TiersPost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(prismaMock.commissionTier.create).not.toHaveBeenCalled();
  });

  it("returns 400 when ratePercent is greater than 100", async () => {
    withSession();
    const req = {
      json: async () => ({ minAmount: 0, maxAmount: 1000, ratePercent: 101 }),
    } as unknown as NextRequest;
    const res = await TiersPost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(prismaMock.commissionTier.create).not.toHaveBeenCalled();
  });

  it("returns 201 and creates tier with valid body", async () => {
    withSession();
    prismaMock.commissionTier.aggregate.mockResolvedValue({
      _max: { sortOrder: 0 },
      _count: { id: 0 },
      _avg: null,
      _sum: null,
      _min: null,
    } as any);
    prismaMock.commissionTier.create.mockResolvedValue({
      id: "t_new",
      minAmount: new Prisma.Decimal("0"),
      maxAmount: new Prisma.Decimal("2000"),
      ratePercent: new Prisma.Decimal("10"),
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = {
      json: async () => ({ minAmount: 0, maxAmount: 2000, ratePercent: 10 }),
    } as unknown as NextRequest;
    const res = await TiersPost(req);
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data).toMatchObject({
      id: "t_new",
      minAmount: 0,
      maxAmount: 2000,
      ratePercent: 10,
      sortOrder: 1,
    });
    expect(prismaMock.commissionTier.create).toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/commission-tiers/[id]", () => {
  const context = { params: Promise.resolve({ id: "t1" }) };

  beforeEach(() => getAdminSession.mockReset());

  it("returns 401 when no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const req = {
      json: async () => ({ ratePercent: 5 }),
    } as unknown as NextRequest;
    const res = await TierPatch(req, context);
    expect(res.status).toBe(401);
  });

  it("returns 404 when tier does not exist", async () => {
    withSession();
    prismaMock.commissionTier.findUnique.mockResolvedValue(null);
    const req = {
      json: async () => ({ ratePercent: 5 }),
    } as unknown as NextRequest;
    const res = await TierPatch(req, context);
    expect(res.status).toBe(404);
  });

  it("returns 400 when minAmount >= maxAmount in body", async () => {
    withSession();
    prismaMock.commissionTier.findUnique.mockResolvedValue({
      id: "t1",
      minAmount: new Prisma.Decimal("0"),
      maxAmount: new Prisma.Decimal("1000"),
      ratePercent: new Prisma.Decimal("3"),
      sortOrder: 0,
    } as any);
    const req = {
      json: async () => ({ minAmount: 500, maxAmount: 400 }),
    } as unknown as NextRequest;
    const res = await TierPatch(req, context);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/minAmount|maxAmount/);
  });

  it("returns 400 when ratePercent is greater than 100 in PATCH", async () => {
    withSession();
    prismaMock.commissionTier.findUnique.mockResolvedValue({
      id: "t1",
      minAmount: new Prisma.Decimal("0"),
      maxAmount: new Prisma.Decimal("1000"),
      ratePercent: new Prisma.Decimal("3"),
      sortOrder: 0,
    } as any);
    const req = {
      json: async () => ({ ratePercent: 101 }),
    } as unknown as NextRequest;
    const res = await TierPatch(req, context);
    expect(res.status).toBe(400);
    expect(prismaMock.commissionTier.update).not.toHaveBeenCalled();
  });

  it("returns 200 and updates tier", async () => {
    withSession();
    prismaMock.commissionTier.findUnique.mockResolvedValue({
      id: "t1",
      minAmount: new Prisma.Decimal("0"),
      maxAmount: new Prisma.Decimal("1000"),
      ratePercent: new Prisma.Decimal("3"),
      sortOrder: 0,
    } as any);
    prismaMock.commissionTier.update.mockResolvedValue({
      id: "t1",
      minAmount: new Prisma.Decimal("0"),
      maxAmount: new Prisma.Decimal("1000"),
      ratePercent: new Prisma.Decimal("5"),
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = {
      json: async () => ({ ratePercent: 5 }),
    } as unknown as NextRequest;
    const res = await TierPatch(req, context);
    expect(res.status).toBe(200);
    expect(prismaMock.commissionTier.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({ ratePercent: 5 }),
    });
  });
});

describe("DELETE /api/admin/commission-tiers/[id]", () => {
  const context = { params: Promise.resolve({ id: "t1" }) };

  beforeEach(() => getAdminSession.mockReset());

  it("returns 401 when no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const res = await TierDelete({} as NextRequest, context);
    expect(res.status).toBe(401);
  });

  it("returns 404 when tier does not exist", async () => {
    withSession();
    prismaMock.commissionTier.findUnique.mockResolvedValue(null);
    const res = await TierDelete({} as NextRequest, context);
    expect(res.status).toBe(404);
  });

  it("returns 204 and deletes tier", async () => {
    withSession();
    prismaMock.commissionTier.findUnique.mockResolvedValue({
      id: "t1",
      minAmount: new Prisma.Decimal("0"),
      maxAmount: new Prisma.Decimal("1000"),
      ratePercent: new Prisma.Decimal("5"),
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.commissionTier.delete.mockResolvedValue({} as never);
    const res = await TierDelete({} as NextRequest, context);
    expect(res.status).toBe(204);
    expect(prismaMock.commissionTier.delete).toHaveBeenCalledWith({
      where: { id: "t1" },
    });
  });
});

describe("GET /api/admin/distributors", () => {
  beforeEach(() => {
    getAdminSession.mockReset();
    listDistributors.mockReset();
  });

  it("returns 401 when no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const res = await DistributorsGet();
    expect(res.status).toBe(401);
  });

  it("returns 200 with distributors and stats", async () => {
    withSession();
    const mockDistributors = [
      {
        id: "dist_1",
        email: "d@x.com",
        name: "D",
        distributorCode: "PROMO1",
        discountCodeEnabled: true,
        discountPercent: 5,
        disabledAt: null,
        createdAt: new Date(),
        orderCount: 5,
        completedOrderCount: 3,
        totalCommission: 100,
        withdrawableBalance: 60,
      },
    ];
    listDistributors.mockResolvedValue(mockDistributors);

    const res = await DistributorsGet();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toMatchObject({
      id: "dist_1",
      email: "d@x.com",
      distributorCode: "PROMO1",
      discountCodeEnabled: true,
      discountPercent: 5,
      orderCount: 5,
      completedOrderCount: 3,
      totalCommission: 100,
      withdrawableBalance: 60,
    });
    expect(listDistributors).toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/distributors/[id]", () => {
  const context = { params: Promise.resolve({ id: "dist_1" }) };

  beforeEach(() => {
    getAdminSession.mockReset();
    updateDistributor.mockReset();
    resetDistributorPassword.mockReset();
  });

  it("returns 401 when no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const req = {
      json: async () => ({ disabled: true }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(401);
  });

  it("resetPassword action returns one-time password", async () => {
    withSession();
    resetDistributorPassword.mockResolvedValue("TempPass12345678");
    const req = {
      json: async () => ({ action: "resetPassword" }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.password).toBe("TempPass12345678");
    expect(resetDistributorPassword).toHaveBeenCalledWith("dist_1");
    expect(updateDistributor).not.toHaveBeenCalled();
  });

  it("returns 400 when action is mixed with update fields (strict)", async () => {
    withSession();
    const req = {
      json: async () => ({ action: "resetPassword", disabled: true }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(400);
    expect(resetDistributorPassword).not.toHaveBeenCalled();
    expect(updateDistributor).not.toHaveBeenCalled();
  });

  it("returns 400 on unknown action value", async () => {
    withSession();
    const req = {
      json: async () => ({ action: "deleteEverything" }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(400);
    expect(resetDistributorPassword).not.toHaveBeenCalled();
  });

  it("resetPassword returns 404 when distributor not found", async () => {
    withSession();
    resetDistributorPassword.mockRejectedValue(new DistributorNotFoundError("not found"));
    const req = {
      json: async () => ({ action: "resetPassword" }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(404);
  });

  it("resetPassword returns 404 when distributor has no credential account", async () => {
    withSession();
    resetDistributorPassword.mockRejectedValue(new NoCredentialAccountError());
    const req = {
      json: async () => ({ action: "resetPassword" }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(404);
  });

  it("returns 404 when distributor not found", async () => {
    withSession();
    updateDistributor.mockRejectedValue(new DistributorNotFoundError("not found"));
    const req = {
      json: async () => ({ disabled: true }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(404);
  });

  it("returns 200 and sets disabledAt when disabled: true", async () => {
    withSession();
    const mockUser = {
      id: "dist_1",
      email: "d@x.com",
      name: "D",
      distributorCode: "PROMO1",
      discountCodeEnabled: false,
      discountPercent: null,
      disabledAt: new Date(),
    };
    updateDistributor.mockResolvedValue(mockUser);
    const req = {
      json: async () => ({ disabled: true }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.disabledAt).toBeDefined();
    expect(updateDistributor).toHaveBeenCalledWith("dist_1", { disabled: true });
  });

  it("returns 200 and clears disabledAt when disabled: false", async () => {
    withSession();
    const mockUser = {
      id: "dist_1",
      email: "d@x.com",
      name: "D",
      distributorCode: "PROMO1",
      discountCodeEnabled: false,
      discountPercent: null,
      disabledAt: null,
    };
    updateDistributor.mockResolvedValue(mockUser);
    const req = {
      json: async () => ({ disabled: false }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(200);
    expect(updateDistributor).toHaveBeenCalledWith("dist_1", { disabled: false });
  });

  it("returns 200 and updates discountCodeEnabled and discountPercent", async () => {
    withSession();
    const mockUser = {
      id: "dist_1",
      email: "d@x.com",
      name: "D",
      distributorCode: "PROMO1",
      discountCodeEnabled: true,
      discountPercent: 5,
      disabledAt: null,
    };
    updateDistributor.mockResolvedValue(mockUser);
    const req = {
      json: async () => ({ discountCodeEnabled: true, discountPercent: 5 }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.discountCodeEnabled).toBe(true);
    expect(data.discountPercent).toBe(5);
    expect(updateDistributor).toHaveBeenCalledWith("dist_1", { discountCodeEnabled: true, discountPercent: 5 });
  });

  it("returns 400 when discountPercent is greater than 100", async () => {
    withSession();
    const req = {
      json: async () => ({ discountCodeEnabled: true, discountPercent: 101 }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when discountPercent is negative", async () => {
    withSession();
    const req = {
      json: async () => ({ discountCodeEnabled: true, discountPercent: -1 }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when discountPercent is not a number", async () => {
    withSession();
    const req = {
      json: async () => ({ discountCodeEnabled: true, discountPercent: "10" }),
    } as unknown as NextRequest;
    const res = await DistributorPatch(req, context);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe("DELETE /api/admin/distributors/[id]", () => {
  const context = { params: Promise.resolve({ id: "dist_1" }) };

  beforeEach(() => {
    getAdminSession.mockReset();
    deleteDistributor.mockReset();
  });

  it("returns 401 when no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const res = await DistributorDelete({} as NextRequest, context);
    expect(res.status).toBe(401);
  });

  it("returns 404 when distributor does not exist", async () => {
    withSession();
    deleteDistributor.mockRejectedValue(new DistributorNotFoundError("not found"));
    const res = await DistributorDelete({} as NextRequest, context);
    expect(res.status).toBe(404);
  });

  it("returns 400 when distributor is not disabled", async () => {
    withSession();
    deleteDistributor.mockRejectedValue(new DistributorNotDisabledError("not disabled"));
    const res = await DistributorDelete({} as NextRequest, context);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("returns 400 when distributor has associations", async () => {
    withSession();
    deleteDistributor.mockRejectedValue(new DistributorHasAssociationsError("has associations"));
    const res = await DistributorDelete({} as NextRequest, context);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("returns 200 when deletion succeeds", async () => {
    withSession();
    deleteDistributor.mockResolvedValue(undefined);
    const res = await DistributorDelete({} as NextRequest, context);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteDistributor).toHaveBeenCalledWith("dist_1");
  });
});

describe("GET /api/admin/withdrawals", () => {
  beforeEach(() => getAdminSession.mockReset());

  it("returns 401 when no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const req = createRequest("http://localhost/api/admin/withdrawals");
    const res = await WithdrawalsGet(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with withdrawals and optional status filter", async () => {
    withSession();
    prismaMock.withdrawal.findMany.mockResolvedValue([
      {
        id: "w1",
        distributorId: "dist_1",
        amount: new Prisma.Decimal("50"),
        status: "PENDING",
        receiptImageUrl: null,
        note: null,
        processedAt: null,
        feePercent: null,
        feeAmount: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        distributor: { id: "dist_1", email: "d@x.com", name: "D" },
      },
    ] as any);
    const req = createRequest(
      "http://localhost/api/admin/withdrawals?status=PENDING",
    );
    const res = await WithdrawalsGet(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toMatchObject({
      id: "w1",
      distributorId: "dist_1",
      amount: 50,
      status: "PENDING",
    });
    expect(prismaMock.withdrawal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING" },
      }),
    );
  });
});

describe("PATCH /api/admin/withdrawals/[id]", () => {
  const context = { params: Promise.resolve({ id: "w1" }) };

  beforeEach(() => {
    getAdminSession.mockReset()
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
  });

  it("returns 401 when no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const req = {
      json: async () => ({ status: "PAID" }),
    } as unknown as NextRequest;
    const res = await WithdrawalPatch(req, context);
    expect(res.status).toBe(401);
  });

  it("returns 404 when withdrawal does not exist", async () => {
    withSession();
    prismaMock.withdrawal.findUnique.mockResolvedValue(null);
    const req = {
      json: async () => ({ status: "PAID" }),
    } as unknown as NextRequest;
    const res = await WithdrawalPatch(req, context);
    expect(res.status).toBe(404);
  });

  it("returns 400 when withdrawal is not PENDING", async () => {
    withSession();
    prismaMock.withdrawal.findUnique.mockResolvedValue({
      id: "w1",
      status: "PAID",
      distributorId: "dist_1",
      amount: new Prisma.Decimal("50"),
      receiptImageUrl: null,
      note: null,
      processedAt: new Date(),
      feePercent: null,
      feeAmount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = {
      json: async () => ({ status: "PAID" }),
    } as unknown as NextRequest;
    const res = await WithdrawalPatch(req, context);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/PENDING/);
  });

  it("returns 400 when status is invalid (e.g. PENDING or unknown) to prevent reverting state", async () => {
    withSession();
    prismaMock.withdrawal.findUnique.mockResolvedValue({
      id: "w1",
      status: "PENDING",
      distributorId: "dist_1",
      amount: new Prisma.Decimal("50"),
      receiptImageUrl: null,
      note: null,
      processedAt: null,
      feePercent: null,
      feeAmount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = {
      json: async () => ({ status: "PENDING" }),
    } as unknown as NextRequest;
    const res = await WithdrawalPatch(req, context);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(prismaMock.withdrawal.update).not.toHaveBeenCalled();
  });

  it("returns 200 and updates to PAID with note and processedAt", async () => {
    withSession();
    prismaMock.withdrawal.findUnique.mockResolvedValue({
      id: "w1",
      status: "PENDING",
      distributorId: "dist_1",
      amount: new Prisma.Decimal("50"),
      receiptImageUrl: null,
      note: null,
      processedAt: null,
      feePercent: null,
      feeAmount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal("200") } } as any);
    prismaMock.withdrawal.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal("0") } } as any);
    prismaMock.invitationMilestoneBonus.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal("0") } } as any);
    prismaMock.withdrawal.update.mockResolvedValue({
      id: "w1",
      distributorId: "dist_1",
      amount: new Prisma.Decimal("50"),
      status: "PAID",
      receiptImageUrl: null,
      note: "Done",
      processedAt: new Date(),
      feePercent: null,
      feeAmount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      distributor: { id: "dist_1", email: "d@x.com", name: "D" },
    } as any);
    const req = {
      json: async () => ({ status: "PAID", note: "Done" }),
    } as unknown as NextRequest;
    const res = await WithdrawalPatch(req, context);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      id: "w1",
      status: "PAID",
      note: "Done",
    });
    expect(data.processedAt).toBeDefined();
    expect(prismaMock.withdrawal.update).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: expect.objectContaining({
        status: "PAID",
        note: "Done",
        processedAt: expect.any(Date),
      }),
      include: expect.any(Object),
    });
  });
});

function createRequest(
  url = "http://localhost/api/admin/withdrawals",
): NextRequest {
  return { url } as NextRequest;
}
