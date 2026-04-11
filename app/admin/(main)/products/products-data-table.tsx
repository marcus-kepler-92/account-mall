"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
    type Row,
} from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ClientDataTableToolbar, ClientDataTablePagination } from "@/app/admin/components"
import { productsColumns, type ProductRow } from "./products-columns"

function SortableRow({ row, isFiltered }: { row: Row<ProductRow>; isFiltered: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: row.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative" as const,
        zIndex: isDragging ? 1 : undefined,
    }

    return (
        <TableRow ref={setNodeRef} style={style} data-state={row.getIsSelected() && "selected"}>
            {row.getVisibleCells().map((cell) => {
                const isDragHandle = cell.column.id === "drag-handle"
                return (
                    <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={isDragHandle && isFiltered ? "pointer-events-none opacity-0" : undefined}
                        {...(isDragHandle && !isFiltered ? { ...attributes, ...listeners } : {})}
                    >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                )
            })}
        </TableRow>
    )
}

const statusOptions = [
    { label: "全部", value: "" },
    { label: "上架", value: "ACTIVE" },
    { label: "下架", value: "INACTIVE" },
]

export function ProductsDataTable({ data, actions }: { data: ProductRow[]; actions?: ReactNode }) {
    const router = useRouter()
    const [rows, setRows] = useState<ProductRow[]>(data)
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const isFiltered =
        columnFilters.length > 0 &&
        columnFilters.some((f) => f.value !== "" && f.value !== undefined)

    const table = useReactTable({
        data: rows,
        columns: productsColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getRowId: (row) => row.id,
        initialState: { pagination: { pageSize: 20 } },
        state: { sorting, columnFilters, columnVisibility },
    })

    const sensors = useSensors(useSensor(PointerSensor))

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = rows.findIndex((r) => r.id === active.id)
        const newIndex = rows.findIndex((r) => r.id === over.id)
        const reordered = arrayMove(rows, oldIndex, newIndex)

        setRows(reordered)

        // Sends full dataset — safe because products use client-side pagination (small count).
        // If server-side pagination is ever added, this needs to send only the visible page items
        // with their correct absolute sort positions.
        try {
            const res = await fetch("/api/admin/products/reorder", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: reordered.map((r) => r.id) }),
            })
            if (!res.ok) {
                throw new Error("reorder failed")
            }
        } catch {
            toast.error("排序保存失败，已恢复原顺序")
            router.refresh()
        }
    }

    const rowModel = table.getRowModel()

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">商品列表</CardTitle>
                    {actions}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <ClientDataTableToolbar
                    table={table}
                    searchColumn="name"
                    searchPlaceholder="搜索商品名称…"
                    statusColumn="status"
                    statusOptions={statusOptions}
                />
                <Separator />
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={rowModel.rows.map((r) => r.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                style={{ width: header.getSize() }}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                          header.column.columnDef.header,
                                                          header.getContext()
                                                      )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {rowModel.rows.length ? (
                                    rowModel.rows.map((row) => (
                                        <SortableRow
                                            key={row.id}
                                            row={row}
                                            isFiltered={isFiltered}
                                        />
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={productsColumns.length}
                                            className="h-24 text-center"
                                        >
                                            暂无商品
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </SortableContext>
                </DndContext>
                <ClientDataTablePagination table={table} />
            </CardContent>
        </Card>
    )
}
