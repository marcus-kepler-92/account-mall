"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { editOrderCostSchema, type EditOrderCostInput } from "@/lib/validations/order"

type Props = {
    orderId: string
    /** Current total cost, used to seed the dialog; null when not recorded yet. */
    cost: number | null
    /** Editing is only allowed for COMPLETED orders (cost is settled by then). */
    editable: boolean
}

/**
 * Edit affordance for an order's cost. Renders only the pencil trigger + dialog;
 * the cost value itself is displayed by the parent so it stays aligned with the
 * other amounts in the ledger. Renders nothing when the order is not editable.
 */
export function OrderCostEditor({ orderId, cost, editable }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)

    const form = useForm<EditOrderCostInput>({
        resolver: zodResolver(editOrderCostSchema),
        defaultValues: { costTotal: cost ?? 0 },
    })

    if (!editable) return null

    const onSubmit = async (values: EditOrderCostInput) => {
        setBusy(true)
        const res = await fetch(`/api/admin/orders/${orderId}/cost`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
        })
        setBusy(false)
        if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            toast.error(j?.error ?? "保存失败")
            return
        }
        toast.success("成本已更新")
        setOpen(false)
        router.refresh()
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o)
                if (o) form.reset({ costTotal: cost ?? 0 })
            }}
        >
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 text-muted-foreground"
                >
                    <Pencil className="size-3" />
                    <span className="sr-only">编辑成本</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>编辑订单成本</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="costTotal"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>成本总额（¥）</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            name={field.name}
                                            ref={field.ref}
                                            onBlur={field.onBlur}
                                            value={
                                                Number.isNaN(field.value)
                                                    ? ""
                                                    : field.value
                                            }
                                            onChange={(e) =>
                                                field.onChange(
                                                    e.target.valueAsNumber,
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    取消
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={busy}>
                                保存
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
