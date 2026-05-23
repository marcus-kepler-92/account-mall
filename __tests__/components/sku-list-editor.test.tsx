/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import {
    SkuListEditor,
    type VariantDraft,
} from "@/app/admin/(main)/products/[productId]/variants/sku-list-editor"

jest.mock("sonner", () => ({
    toast: { success: jest.fn(), error: jest.fn() },
}))

// Default empty list response for edit-mode initial GET.
function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
    global.fetch = jest.fn().mockImplementation(async (url, init) => {
        const body = await Promise.resolve(handler(String(url), init))
        if (body && typeof body === "object" && "__status" in body) {
            const { __status, ...rest } = body as {
                __status: number
                [k: string]: unknown
            }
            return {
                ok: __status >= 200 && __status < 300,
                status: __status,
                json: async () => rest,
            } as unknown as Response
        }
        return {
            ok: true,
            status: 200,
            json: async () => body,
        } as unknown as Response
    })
}

beforeEach(() => {
    jest.clearAllMocks()
})

// ─── Create mode (fully controlled) ──────────────────────────────────────────

describe("SkuListEditor (create mode)", () => {
    it("renders an empty body with no rows", () => {
        const onChange = jest.fn()
        render(
            <SkuListEditor mode="create" value={[]} onChange={onChange} />,
        )
        expect(screen.getByText(/暂无 SKU/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /新增 SKU/ })).toBeInTheDocument()
    })

    it("appends a row when the 新增 SKU button is clicked", () => {
        const onChange = jest.fn()
        render(
            <SkuListEditor mode="create" value={[]} onChange={onChange} />,
        )
        fireEvent.click(screen.getByRole("button", { name: /新增 SKU/ }))
        expect(onChange).toHaveBeenCalledTimes(1)
        const next = onChange.mock.calls[0][0] as VariantDraft[]
        expect(next).toHaveLength(1)
        expect(next[0].name).toBe("")
        expect(next[0].isActive).toBe(true)
        expect(next[0]._localId).toMatch(/^local-/)
    })

    it("does not fetch when in create mode", () => {
        const fetchSpy = jest.fn()
        global.fetch = fetchSpy as unknown as typeof fetch
        render(
            <SkuListEditor mode="create" value={[]} onChange={jest.fn()} />,
        )
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it("calls onChange with the updated value when an input changes", () => {
        const onChange = jest.fn()
        const initial: VariantDraft[] = [
            {
                _localId: "l1",
                name: "",
                price: "",
                unitCost: "",
                stockQuantity: "0",
                sortOrder: "0",
                isActive: true,
            },
        ]
        render(
            <SkuListEditor mode="create" value={initial} onChange={onChange} />,
        )
        fireEvent.change(screen.getByLabelText("SKU 名称 1"), {
            target: { value: "1 个月" },
        })
        expect(onChange).toHaveBeenLastCalledWith([
            expect.objectContaining({ name: "1 个月" }),
        ])
    })

    it("removes a row locally without confirmation API call in create mode", async () => {
        const onChange = jest.fn()
        const initial: VariantDraft[] = [
            {
                _localId: "l1",
                name: "1 个月",
                price: "9.9",
                unitCost: "",
                stockQuantity: "10",
                sortOrder: "0",
                isActive: true,
            },
        ]
        render(
            <SkuListEditor mode="create" value={initial} onChange={onChange} />,
        )
        fireEvent.click(screen.getByLabelText("删除 SKU 1"))
        fireEvent.click(await screen.findByRole("button", { name: /^删除$/ }))
        await waitFor(() => {
            expect(onChange).toHaveBeenLastCalledWith([])
        })
    })
})

// ─── Edit mode (autosave, delete via API) ────────────────────────────────────

describe("SkuListEditor (edit mode)", () => {
    it("loads variants from API on mount", async () => {
        mockFetch((url) => {
            if (url.endsWith("/variants")) {
                return {
                    variants: [
                        {
                            id: "v1",
                            name: "1 个月",
                            price: "29.90",
                            unitCost: null,
                            stockQuantity: 5,
                            sortOrder: 0,
                            isActive: true,
                        },
                    ],
                }
            }
            return {}
        })

        render(<SkuListEditor mode="edit" productId="p1" value={[]} />)
        const nameInput = await screen.findByLabelText("SKU 名称 1")
        expect(nameInput).toHaveValue("1 个月")
        expect(screen.getByLabelText("SKU 库存 1")).toHaveValue(5)
    })

    it("PATCHes a row when an input loses focus (autosave)", async () => {
        const calls: { url: string; init?: RequestInit }[] = []
        mockFetch((url, init) => {
            calls.push({ url, init })
            if (url.endsWith("/variants") && (!init || init.method === undefined || init.method === "GET")) {
                return {
                    variants: [
                        {
                            id: "v1",
                            name: "1 个月",
                            price: "29.90",
                            unitCost: null,
                            stockQuantity: 5,
                            sortOrder: 0,
                            isActive: true,
                        },
                    ],
                }
            }
            // PATCH echoes back the row.
            return {
                id: "v1",
                name: "3 个月",
                price: "29.90",
                unitCost: null,
                stockQuantity: 5,
                sortOrder: 0,
                isActive: true,
            }
        })

        render(<SkuListEditor mode="edit" productId="p1" value={[]} />)
        const nameInput = await screen.findByLabelText("SKU 名称 1")
        fireEvent.change(nameInput, { target: { value: "3 个月" } })
        fireEvent.blur(nameInput)
        await waitFor(() => {
            const patch = calls.find((c) => c.init?.method === "PATCH")
            expect(patch).toBeDefined()
            expect(patch!.url).toContain("/api/admin/products/p1/variants/v1")
        })
    })

    it("POSTs a new row on first blur and back-fills the id", async () => {
        let postCount = 0
        mockFetch((url, init) => {
            if (
                url.endsWith("/variants") &&
                (!init || init.method === undefined || init.method === "GET")
            ) {
                return { variants: [] }
            }
            if (init?.method === "POST") {
                postCount++
                return {
                    id: "v_new",
                    name: "标准版",
                    price: "9.90",
                    unitCost: null,
                    stockQuantity: 1,
                    sortOrder: 0,
                    isActive: true,
                }
            }
            return {}
        })

        render(<SkuListEditor mode="edit" productId="p1" value={[]} />)
        // Wait for initial load to complete.
        await screen.findByText(/暂无 SKU/)
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /新增 SKU/ }))
        })

        const nameInput = await screen.findByLabelText("SKU 名称 1")
        const priceInput = screen.getByLabelText("SKU 售价 1")
        fireEvent.change(nameInput, { target: { value: "标准版" } })
        fireEvent.change(priceInput, { target: { value: "9.90" } })
        fireEvent.blur(priceInput)

        await waitFor(() => {
            expect(postCount).toBe(1)
        })
    })

    it("DELETEs a row via API when confirmed", async () => {
        const calls: { url: string; init?: RequestInit }[] = []
        mockFetch((url, init) => {
            calls.push({ url, init })
            if (
                url.endsWith("/variants") &&
                (!init || init.method === undefined || init.method === "GET")
            ) {
                return {
                    variants: [
                        {
                            id: "v1",
                            name: "1 个月",
                            price: "29.90",
                            unitCost: null,
                            stockQuantity: 5,
                            sortOrder: 0,
                            isActive: true,
                        },
                    ],
                }
            }
            if (init?.method === "DELETE") return { ok: true }
            return {}
        })

        render(<SkuListEditor mode="edit" productId="p1" value={[]} />)
        await screen.findByLabelText("SKU 名称 1")
        fireEvent.click(screen.getByLabelText("删除 SKU 1"))
        fireEvent.click(await screen.findByRole("button", { name: /^删除$/ }))

        await waitFor(() => {
            const del = calls.find((c) => c.init?.method === "DELETE")
            expect(del).toBeDefined()
            expect(del!.url).toContain("/api/admin/products/p1/variants/v1")
        })
    })
})
