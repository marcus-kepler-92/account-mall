"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

export type DistributorOption = {
  id: string
  name: string
  distributorCode: string | null
}

interface OrderDistributorCellProps {
  orderId: string
  distributor: { id: string; name: string; distributorCode: string | null } | null
  distributors: DistributorOption[]
}

type Step = "select" | "confirm"

export function OrderDistributorCell({
  orderId,
  distributor,
  distributors,
}: OrderDistributorCellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("select")
  const [pending, setPending] = useState<DistributorOption | null | "clear">(null)
  const [loading, setLoading] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setStep("select")
      setPending(null)
    }
  }

  const handleSelect = (selected: DistributorOption | "clear") => {
    if (
      selected !== "clear" &&
      distributor?.id === (selected as DistributorOption).id
    ) {
      setOpen(false)
      return
    }
    setPending(selected)
    setStep("confirm")
  }

  const handleConfirm = async () => {
    const distributorId = pending === "clear" ? null : (pending as DistributorOption).id
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/distributor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distributorId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? "操作失败")
        return
      }
      toast.success(pending === "clear" ? "已清除分销员" : "已更新分销员")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("操作失败")
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep("select")
    setPending(null)
  }

  const displayName =
    distributor ? (
      <div className="flex flex-col text-xs">
        <span>{distributor.name}</span>
        {distributor.distributorCode && (
          <span className="text-muted-foreground font-mono">{distributor.distributorCode}</span>
        )}
      </div>
    ) : (
      <span className="text-muted-foreground">—</span>
    )

  const confirmLabel =
    pending === "clear"
      ? "（无）"
      : pending
        ? (pending as DistributorOption).name
        : ""

  return (
    <Popover open={open} onOpenChange={(next) => !loading && handleOpenChange(next)}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left text-sm",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
        >
          {displayName}
          <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="start">
        {step === "select" ? (
          <Command>
            <CommandInput placeholder="搜索分销员..." />
            <CommandList>
              <CommandEmpty>无匹配结果</CommandEmpty>
              {distributor && (
                <>
                  <CommandGroup>
                    <CommandItem
                      value="__clear__"
                      onSelect={() => handleSelect("clear")}
                      className="text-muted-foreground"
                    >
                      <X className="size-4" />
                      清除分销员
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              <CommandGroup heading="分销员">
                {distributors.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={`${d.name} ${d.distributorCode ?? ""}`}
                    onSelect={() => handleSelect(d)}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        distributor?.id === d.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{d.name}</span>
                      {d.distributorCode && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {d.distributorCode}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="p-3 space-y-3">
            <p className="text-sm">
              确认将分销员改为{" "}
              <span className="font-medium">{confirmLabel}</span>
              ？
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                disabled={loading}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                确认
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
