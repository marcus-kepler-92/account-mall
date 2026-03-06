import { type NextRequest } from "next/server";
import { POST } from "@/app/api/cards/batch/route";
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

function createRequest(body: Record<string, unknown>): NextRequest {
    return new Request("http://x", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    }) as NextRequest;
}

describe("POST /api/cards/batch", () => {
    const adminSessionMock = getAdminSession as jest.Mock;

    beforeEach(() => {
        adminSessionMock.mockReset();
        prismaMock.card.findMany.mockReset();
        prismaMock.card.deleteMany.mockReset();
        prismaMock.card.updateMany.mockReset();
    });

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null);

        const res = await POST(
            createRequest({ action: "DELETE", cardIds: ["card_1"] })
        );
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 for invalid action", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });

        const res = await POST(
            createRequest({ action: "INVALID", cardIds: ["card_1"] })
        );
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBeDefined();
    });

    it("returns 400 for empty cardIds", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });

        const res = await POST(createRequest({ action: "DELETE", cardIds: [] }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBeDefined();
    });

    it("returns 400 when cardIds exceeds 100", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });

        const cardIds = Array.from({ length: 101 }, (_, i) => `card_${i}`);
        const res = await POST(createRequest({ action: "DELETE", cardIds }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBeDefined();
    });

    describe("DELETE action", () => {
        it("deletes only UNSOLD cards and skips others", async () => {
            adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
            prismaMock.card.findMany.mockResolvedValueOnce([
                { id: "card_1", status: "UNSOLD" },
                { id: "card_2", status: "SOLD" },
                { id: "card_3", status: "UNSOLD" },
            ] as any);
            prismaMock.card.deleteMany.mockResolvedValueOnce({ count: 2 });

            const res = await POST(
                createRequest({
                    action: "DELETE",
                    cardIds: ["card_1", "card_2", "card_3", "card_nonexistent"],
                })
            );
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(2);
            expect(data.skipped).toBe(2);
            expect(prismaMock.card.deleteMany).toHaveBeenCalledWith({
                where: { id: { in: ["card_1", "card_3"] } },
            });
        });

        it("returns success=0 when no cards can be deleted", async () => {
            adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
            prismaMock.card.findMany.mockResolvedValueOnce([
                { id: "card_1", status: "SOLD" },
            ] as any);

            const res = await POST(
                createRequest({ action: "DELETE", cardIds: ["card_1"] })
            );
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(0);
            expect(data.skipped).toBe(1);
            expect(prismaMock.card.deleteMany).not.toHaveBeenCalled();
        });
    });

    describe("DISABLE action", () => {
        it("disables only UNSOLD cards", async () => {
            adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
            prismaMock.card.findMany.mockResolvedValueOnce([
                { id: "card_1", status: "UNSOLD" },
                { id: "card_2", status: "DISABLED" },
            ] as any);
            prismaMock.card.updateMany.mockResolvedValueOnce({ count: 1 });

            const res = await POST(
                createRequest({ action: "DISABLE", cardIds: ["card_1", "card_2"] })
            );
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(1);
            expect(data.skipped).toBe(1);
            expect(prismaMock.card.updateMany).toHaveBeenCalledWith({
                where: { id: { in: ["card_1"] } },
                data: { status: "DISABLED" },
            });
        });
    });

    describe("ENABLE action", () => {
        it("enables only DISABLED cards", async () => {
            adminSessionMock.mockResolvedValueOnce({ id: "admin_1" });
            prismaMock.card.findMany.mockResolvedValueOnce([
                { id: "card_1", status: "DISABLED" },
                { id: "card_2", status: "UNSOLD" },
            ] as any);
            prismaMock.card.updateMany.mockResolvedValueOnce({ count: 1 });

            const res = await POST(
                createRequest({ action: "ENABLE", cardIds: ["card_1", "card_2"] })
            );
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(1);
            expect(data.skipped).toBe(1);
            expect(prismaMock.card.updateMany).toHaveBeenCalledWith({
                where: { id: { in: ["card_1"] } },
                data: { status: "UNSOLD" },
            });
        });
    });
});
