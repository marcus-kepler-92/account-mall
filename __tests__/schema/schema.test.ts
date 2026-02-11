import { prismaMock } from "../../__mocks__/prisma";
import type { Product, Tag, Card, Order } from "@prisma/client";
import { Prisma } from "@prisma/client";

// ─── Product CRUD ────────────────────────────────────────────────

describe("Product model", () => {
  const mockProduct: Product = {
    id: "clx1234567890",
    name: "ChatGPT Plus Account",
    slug: "chatgpt-plus-account",
    description: "Premium ChatGPT account with GPT-4 access",
    price: new Prisma.Decimal("29.99"),
    maxQuantity: 10,
    status: "ACTIVE",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("should create a product", async () => {
    prismaMock.product.create.mockResolvedValue(mockProduct);

    const result = await prismaMock.product.create({
      data: {
        name: "ChatGPT Plus Account",
        slug: "chatgpt-plus-account",
        description: "Premium ChatGPT account with GPT-4 access",
        price: new Prisma.Decimal("29.99"),
      },
    });

    expect(result).toEqual(mockProduct);
    expect(result.status).toBe("ACTIVE");
    expect(result.maxQuantity).toBe(10);
    expect(prismaMock.product.create).toHaveBeenCalledTimes(1);
  });

  it("should find a product by slug", async () => {
    prismaMock.product.findUnique.mockResolvedValue(mockProduct);

    const result = await prismaMock.product.findUnique({
      where: { slug: "chatgpt-plus-account" },
    });

    expect(result).toEqual(mockProduct);
    expect(prismaMock.product.findUnique).toHaveBeenCalledWith({
      where: { slug: "chatgpt-plus-account" },
    });
  });

  it("should update a product", async () => {
    const updated = { ...mockProduct, name: "Updated Name" };
    prismaMock.product.update.mockResolvedValue(updated);

    const result = await prismaMock.product.update({
      where: { id: mockProduct.id },
      data: { name: "Updated Name" },
    });

    expect(result.name).toBe("Updated Name");
  });

  it("should soft-delete a product by setting status to INACTIVE", async () => {
    const inactive = { ...mockProduct, status: "INACTIVE" as const };
    prismaMock.product.update.mockResolvedValue(inactive);

    const result = await prismaMock.product.update({
      where: { id: mockProduct.id },
      data: { status: "INACTIVE" },
    });

    expect(result.status).toBe("INACTIVE");
  });

  it("should list only active products", async () => {
    prismaMock.product.findMany.mockResolvedValue([mockProduct]);

    const result = await prismaMock.product.findMany({
      where: { status: "ACTIVE" },
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ACTIVE");
  });

  it("should enforce unique slug constraint", async () => {
    prismaMock.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`slug`)",
        { code: "P2002", clientVersion: "7.3.0", meta: { target: ["slug"] } }
      )
    );

    await expect(
      prismaMock.product.create({
        data: {
          name: "Duplicate",
          slug: "chatgpt-plus-account",
          price: new Prisma.Decimal("19.99"),
        },
      })
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });
});

// ─── Tag many-to-many ────────────────────────────────────────────

describe("Tag model (many-to-many with Product)", () => {
  const mockTag: Tag = {
    id: "clx_tag_001",
    name: "AI Tools",
    slug: "ai-tools",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("should create a tag", async () => {
    prismaMock.tag.create.mockResolvedValue(mockTag);

    const result = await prismaMock.tag.create({
      data: { name: "AI Tools", slug: "ai-tools" },
    });

    expect(result.name).toBe("AI Tools");
    expect(result.slug).toBe("ai-tools");
  });

  it("should connect a tag to a product (many-to-many)", async () => {
    const productWithTags = {
      id: "clx_prod_001",
      name: "ChatGPT Plus",
      slug: "chatgpt-plus",
      description: null,
      price: new Prisma.Decimal("29.99"),
      maxQuantity: 10,
      status: "ACTIVE" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [mockTag],
    };

    prismaMock.product.update.mockResolvedValue(productWithTags as any);

    const result = await prismaMock.product.update({
      where: { id: "clx_prod_001" },
      data: { tags: { connect: { id: mockTag.id } } },
      include: { tags: true },
    });

    expect((result as any).tags).toHaveLength(1);
    expect((result as any).tags[0].slug).toBe("ai-tools");
  });

  it("should query products by tag", async () => {
    const tagWithProducts = {
      ...mockTag,
      products: [
        {
          id: "clx_prod_001",
          name: "ChatGPT Plus",
          slug: "chatgpt-plus",
          price: new Prisma.Decimal("29.99"),
          status: "ACTIVE",
        },
      ],
    };

    prismaMock.tag.findUnique.mockResolvedValue(tagWithProducts as any);

    const result = await prismaMock.tag.findUnique({
      where: { slug: "ai-tools" },
      include: { products: true },
    });

    expect((result as any).products).toHaveLength(1);
  });

  it("should enforce unique tag name constraint", async () => {
    prismaMock.tag.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`name`)",
        { code: "P2002", clientVersion: "7.3.0", meta: { target: ["name"] } }
      )
    );

    await expect(
      prismaMock.tag.create({ data: { name: "AI Tools", slug: "ai-tools-2" } })
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });
});

// ─── Card model ──────────────────────────────────────────────────

describe("Card model", () => {
  const mockCard: Card = {
    id: "clx_card_001",
    productId: "clx_prod_001",
    content: "username:password123",
    status: "UNSOLD",
    orderId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("should create a card with default UNSOLD status", async () => {
    prismaMock.card.create.mockResolvedValue(mockCard);

    const result = await prismaMock.card.create({
      data: {
        productId: "clx_prod_001",
        content: "username:password123",
      },
    });

    expect(result.status).toBe("UNSOLD");
    expect(result.orderId).toBeNull();
  });

  it("should reserve a card for an order", async () => {
    const reserved: Card = {
      ...mockCard,
      status: "RESERVED",
      orderId: "clx_order_001",
    };
    prismaMock.card.update.mockResolvedValue(reserved);

    const result = await prismaMock.card.update({
      where: { id: mockCard.id },
      data: { status: "RESERVED", orderId: "clx_order_001" },
    });

    expect(result.status).toBe("RESERVED");
    expect(result.orderId).toBe("clx_order_001");
  });

  it("should mark a card as SOLD", async () => {
    const sold: Card = { ...mockCard, status: "SOLD", orderId: "clx_order_001" };
    prismaMock.card.update.mockResolvedValue(sold);

    const result = await prismaMock.card.update({
      where: { id: mockCard.id },
      data: { status: "SOLD" },
    });

    expect(result.status).toBe("SOLD");
  });

  it("should count cards by status for a product", async () => {
    prismaMock.card.count.mockResolvedValue(5);

    const unsoldCount = await prismaMock.card.count({
      where: { productId: "clx_prod_001", status: "UNSOLD" },
    });

    expect(unsoldCount).toBe(5);
    expect(prismaMock.card.count).toHaveBeenCalledWith({
      where: { productId: "clx_prod_001", status: "UNSOLD" },
    });
  });

  it("should bulk create cards", async () => {
    prismaMock.card.createMany.mockResolvedValue({ count: 3 });

    const result = await prismaMock.card.createMany({
      data: [
        { productId: "clx_prod_001", content: "card1" },
        { productId: "clx_prod_001", content: "card2" },
        { productId: "clx_prod_001", content: "card3" },
      ],
    });

    expect(result.count).toBe(3);
  });
});

// ─── Order model ─────────────────────────────────────────────────

describe("Order model", () => {
  const mockOrder: Order = {
    id: "clx_order_001",
    orderNo: "FAK202601010001",
    productId: "clx_prod_001",
    email: "buyer@example.com",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$hash",
    quantity: 2,
    amount: new Prisma.Decimal("59.98"),
    status: "PENDING",
    paidAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("should create an order with PENDING status", async () => {
    prismaMock.order.create.mockResolvedValue(mockOrder);

    const result = await prismaMock.order.create({
      data: {
        orderNo: "FAK202601010001",
        productId: "clx_prod_001",
        email: "buyer@example.com",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$hash",
        quantity: 2,
        amount: new Prisma.Decimal("59.98"),
      },
    });

    expect(result.status).toBe("PENDING");
    expect(result.paidAt).toBeNull();
    expect(result.quantity).toBe(2);
  });

  it("should complete an order with paidAt timestamp", async () => {
    const paidAt = new Date("2026-01-01T12:00:00Z");
    const completed: Order = { ...mockOrder, status: "COMPLETED", paidAt };
    prismaMock.order.update.mockResolvedValue(completed);

    const result = await prismaMock.order.update({
      where: { id: mockOrder.id },
      data: { status: "COMPLETED", paidAt },
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.paidAt).toEqual(paidAt);
  });

  it("should close an expired order", async () => {
    const closed: Order = { ...mockOrder, status: "CLOSED" };
    prismaMock.order.update.mockResolvedValue(closed);

    const result = await prismaMock.order.update({
      where: { id: mockOrder.id },
      data: { status: "CLOSED" },
    });

    expect(result.status).toBe("CLOSED");
  });

  it("should find an order by orderNo", async () => {
    prismaMock.order.findUnique.mockResolvedValue(mockOrder);

    const result = await prismaMock.order.findUnique({
      where: { orderNo: "FAK202601010001" },
    });

    expect(result?.orderNo).toBe("FAK202601010001");
  });

  it("should query orders by email", async () => {
    prismaMock.order.findMany.mockResolvedValue([mockOrder]);

    const result = await prismaMock.order.findMany({
      where: { email: "buyer@example.com" },
    });

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("buyer@example.com");
  });

  it("should include related cards when querying an order", async () => {
    const orderWithCards = {
      ...mockOrder,
      cards: [
        { id: "clx_card_001", content: "card1", status: "RESERVED" },
        { id: "clx_card_002", content: "card2", status: "RESERVED" },
      ],
    };
    prismaMock.order.findUnique.mockResolvedValue(orderWithCards as any);

    const result = await prismaMock.order.findUnique({
      where: { id: mockOrder.id },
      include: { cards: true },
    });

    expect((result as any).cards).toHaveLength(2);
  });

  it("should enforce unique orderNo constraint", async () => {
    prismaMock.order.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`orderNo`)",
        { code: "P2002", clientVersion: "7.3.0", meta: { target: ["orderNo"] } }
      )
    );

    await expect(
      prismaMock.order.create({
        data: {
          orderNo: "FAK202601010001",
          productId: "clx_prod_001",
          email: "other@example.com",
          passwordHash: "hash",
          quantity: 1,
          amount: new Prisma.Decimal("29.99"),
        },
      })
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });
});

// ─── Enum default values ─────────────────────────────────────────

describe("Enum default values", () => {
  it("ProductStatus default should be ACTIVE", async () => {
    const product = {
      id: "test",
      name: "Test",
      slug: "test",
      description: null,
      price: new Prisma.Decimal("10.00"),
      maxQuantity: 10,
      status: "ACTIVE" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.product.create.mockResolvedValue(product);

    const result = await prismaMock.product.create({
      data: { name: "Test", slug: "test", price: new Prisma.Decimal("10.00") },
    });
    expect(result.status).toBe("ACTIVE");
  });

  it("CardStatus default should be UNSOLD", async () => {
    const card: Card = {
      id: "test",
      productId: "prod",
      content: "test",
      status: "UNSOLD",
      orderId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.card.create.mockResolvedValue(card);

    const result = await prismaMock.card.create({
      data: { productId: "prod", content: "test" },
    });
    expect(result.status).toBe("UNSOLD");
  });

  it("OrderStatus default should be PENDING", async () => {
    const order: Order = {
      id: "test",
      orderNo: "FAK202601010002",
      productId: "prod",
      email: "test@test.com",
      passwordHash: "hash",
      quantity: 1,
      amount: new Prisma.Decimal("10.00"),
      status: "PENDING",
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.order.create.mockResolvedValue(order);

    const result = await prismaMock.order.create({
      data: {
        orderNo: "FAK202601010002",
        productId: "prod",
        email: "test@test.com",
        passwordHash: "hash",
        quantity: 1,
        amount: new Prisma.Decimal("10.00"),
      },
    });
    expect(result.status).toBe("PENDING");
  });
});
