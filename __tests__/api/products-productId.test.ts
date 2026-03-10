import { type NextRequest } from "next/server";
import { GET, PUT, DELETE } from "@/app/api/products/[productId]/route";
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

type RouteContext = { params: Promise<{ productId: string }> };

function createContext(productId: string): RouteContext {
  return { params: Promise.resolve({ productId }) };
}

function createUrlRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

function createJsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

describe("GET /api/products/[productId]", () => {
  it("returns 404 when product does not exist", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null);

    const res = await GET(
      createUrlRequest("http://localhost/api/products/prod_1"),
      createContext("prod_1"),
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data).toEqual({ error: "Product not found" });
  });

  it("returns product with stock count when found", async () => {
    const product = {
      id: "prod_1",
      name: "Test",
      slug: "test",
      description: null,
      image: null,
      price: 50,
      maxQuantity: 5,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [{ id: "t1", name: "Tag", slug: "tag" }],
    };
    prismaMock.product.findUnique.mockResolvedValueOnce(product);
    prismaMock.card.count.mockResolvedValueOnce(7);

    const res = await GET(
      createUrlRequest("http://localhost/api/products/prod_1"),
      createContext("prod_1"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      id: "prod_1",
      name: "Test",
      slug: "test",
      price: 50,
      stock: 7,
    });
    expect(prismaMock.product.findUnique).toHaveBeenCalledWith({
      where: { id: "prod_1" },
      include: {
        tags: { select: { id: true, name: true, slug: true } },
      },
    });
  });

  it("returns product when found", async () => {
    const product = {
      id: "prod_public",
      name: "Public",
      slug: "public",
      price: 50,
      tags: [],
    };
    prismaMock.product.findUnique.mockResolvedValueOnce(product);
    prismaMock.card.count.mockResolvedValueOnce(3);

    const res = await GET(
      createUrlRequest("http://localhost/api/products/prod_public"),
      createContext("prod_public"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      id: "prod_public",
      name: "Public",
    });
  });
});

describe("PUT /api/products/[productId]", () => {
  const adminSessionMock = getAdminSession as jest.Mock;

  beforeEach(() => {
    adminSessionMock.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null);

    const res = await PUT(
      createJsonRequest({ name: "Updated" }),
      createContext("prod_1"),
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when body is invalid JSON", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
    const req = {
      json: async () => {
        throw new Error("bad json");
      },
    } as unknown as NextRequest;

    const res = await PUT(req, createContext("prod_1"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 when validation fails", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
    prismaMock.product.findUnique.mockResolvedValueOnce({
      id: "prod_1",
      slug: "test",
    });

    const res = await PUT(
      createJsonRequest({ price: -1 }),
      createContext("prod_1"),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Validation failed");
  });

  it("returns 404 when product does not exist", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
    prismaMock.product.findUnique.mockResolvedValueOnce(null);

    const res = await PUT(
      createJsonRequest({ name: "Updated" }),
      createContext("nonexistent"),
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data).toEqual({ error: "Product not found" });
  });

  it("returns 409 when new slug already exists", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
    prismaMock.product.findUnique
      .mockResolvedValueOnce({
        id: "prod_1",
        slug: "old-slug",
      })
      .mockResolvedValueOnce({
        id: "other",
        slug: "taken-slug",
      });

    const res = await PUT(
      createJsonRequest({ slug: "taken-slug" }),
      createContext("prod_1"),
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data).toEqual({
      error: "A product with this slug already exists",
    });
  });

  it("updates product with tagIds and returns 200", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
    prismaMock.product.findUnique.mockResolvedValueOnce({
      id: "prod_1",
      slug: "test",
    });
    const updated = {
      id: "prod_1",
      name: "Prod",
      slug: "test",
      price: 50,
      tags: [
        { id: "tag_1", name: "T1", slug: "t1" },
        { id: "tag_2", name: "T2", slug: "t2" },
      ],
    };
    prismaMock.product.update.mockResolvedValueOnce(updated);

    const res = await PUT(
      createJsonRequest({ tagIds: ["tag_1", "tag_2"] }),
      createContext("prod_1"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: "prod_1" },
      data: expect.objectContaining({
        tags: {
          set: [{ id: "tag_1" }, { id: "tag_2" }],
        },
      }),
      include: expect.any(Object),
    });
    expect(data.tags).toHaveLength(2);
  });

  it("updates product and returns 200", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
    prismaMock.product.findUnique.mockResolvedValueOnce({
      id: "prod_1",
      slug: "test",
    });
    const updated = {
      id: "prod_1",
      name: "Updated Name",
      slug: "test",
      price: 99,
      tags: [],
    };
    prismaMock.product.update.mockResolvedValueOnce(updated);

    const res = await PUT(
      createJsonRequest({ name: "Updated Name", price: 99 }),
      createContext("prod_1"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      id: "prod_1",
      name: "Updated Name",
      price: 99,
    });
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: "prod_1" },
      data: expect.objectContaining({
        name: "Updated Name",
        price: 99,
      }),
      include: expect.any(Object),
    });
  });
});

describe("DELETE /api/products/[productId]", () => {
  const adminSessionMock = getAdminSession as jest.Mock;

  beforeEach(() => {
    adminSessionMock.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null);

    const res = await DELETE(
      createUrlRequest("http://localhost/api/products/prod_1"),
      createContext("prod_1"),
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when product does not exist", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
    prismaMock.product.findUnique.mockResolvedValueOnce(null);

    const res = await DELETE(
      createUrlRequest("http://localhost/api/products/nonexistent"),
      createContext("nonexistent"),
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data).toEqual({ error: "Product not found" });
  });

  it("soft-deletes product and returns 200 when no permanent param", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
    prismaMock.product.findUnique.mockResolvedValueOnce({
      id: "prod_1",
      name: "Test",
    });
    prismaMock.product.update.mockResolvedValueOnce({});

    const res = await DELETE(
      createUrlRequest("http://localhost/api/products/prod_1"),
      createContext("prod_1"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ message: "Product deactivated" });
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: "prod_1" },
      data: { status: "INACTIVE" },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  describe("permanent=true (hard delete)", () => {
    it("returns 400 when product is ACTIVE", async () => {
      adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
      prismaMock.product.findUnique.mockResolvedValueOnce({
        id: "prod_1",
        status: "ACTIVE",
      });

      const res = await DELETE(
        createUrlRequest("http://localhost/api/products/prod_1?permanent=true"),
        createContext("prod_1"),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("只能删除已下架的商品");
      expect(prismaMock.order.count).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("returns 400 when product has orders", async () => {
      adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
      prismaMock.product.findUnique.mockResolvedValueOnce({
        id: "prod_1",
        status: "INACTIVE",
      });
      prismaMock.order.count.mockResolvedValueOnce(2);

      const res = await DELETE(
        createUrlRequest("http://localhost/api/products/prod_1?permanent=true"),
        createContext("prod_1"),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("该商品存在关联订单，无法删除");
      expect(prismaMock.order.count).toHaveBeenCalledWith({
        where: { productId: "prod_1" },
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("hard-deletes product and related data when INACTIVE and no orders", async () => {
      adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
      prismaMock.product.findUnique.mockResolvedValueOnce({
        id: "prod_1",
        status: "INACTIVE",
      });
      prismaMock.order.count.mockResolvedValueOnce(0);
      (prismaMock.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
          fn(prismaMock),
      );

      const res = await DELETE(
        createUrlRequest("http://localhost/api/products/prod_1?permanent=true"),
        createContext("prod_1"),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ message: "Product deleted" });
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.card.deleteMany).toHaveBeenCalledWith({
        where: { productId: "prod_1" },
      });
      expect(prismaMock.restockSubscription.deleteMany).toHaveBeenCalledWith({
        where: { productId: "prod_1" },
      });
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: "prod_1" },
        data: { tags: { set: [] } },
      });
      expect(prismaMock.product.delete).toHaveBeenCalledWith({
        where: { id: "prod_1" },
      });
    });
  });
});
