/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import { useReactTable, getCoreRowModel, createColumnHelper } from "@tanstack/react-table"
import { DataTable } from "@/app/admin/components/data-table"

type Item = { id: string; name: string }
const columnHelper = createColumnHelper<Item>()
const columns = [
    columnHelper.accessor("name", { header: "Name", cell: (info) => info.getValue() }),
]
const data: Item[] = [{ id: "1", name: "Alice" }]

function Wrapper({ onRowClick }: { onRowClick?: (row: Item) => void }) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
    })
    return <DataTable table={table} columns={columns} onRowClick={onRowClick} />
}

describe("DataTable onRowClick", () => {
    it("calls onRowClick with the row data when a row is clicked", () => {
        const handler = jest.fn()
        render(<Wrapper onRowClick={handler} />)
        fireEvent.click(screen.getByText("Alice"))
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler).toHaveBeenCalledWith({ id: "1", name: "Alice" })
    })

    it("applies cursor-pointer class to rows when onRowClick is provided", () => {
        const { container } = render(<Wrapper onRowClick={jest.fn()} />)
        const row = container.querySelector("tbody tr")
        expect(row).toHaveClass("cursor-pointer")
    })

    it("does not apply cursor-pointer when onRowClick is not provided", () => {
        const { container } = render(<Wrapper />)
        const row = container.querySelector("tbody tr")
        expect(row).not.toHaveClass("cursor-pointer")
    })
})
