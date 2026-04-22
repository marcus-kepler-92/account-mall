"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { ChevronsUpDown, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ProductFormSchema } from "@/lib/validations/product"

type CardTemplate = { id: string; name: string; template: string }

export function ProductFormCardTemplateSelect({
  initialTemplates,
}: {
  initialTemplates: CardTemplate[]
}) {
  const { watch, setValue } = useFormContext<ProductFormSchema>()
  const templateIds = (watch("cardTemplateIds") ?? []) as string[]

  const [open, setOpen] = useState(false)

  const toggleTemplate = (id: string) => {
    const next = templateIds.includes(id)
      ? templateIds.filter((t) => t !== id)
      : [...templateIds, id]
    setValue("cardTemplateIds", next)
  }

  const selected = initialTemplates.filter((t) => templateIds.includes(t.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle>卡密模版</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selected.length > 0 ? `已选 ${selected.length} 个模版` : "选择卡密模版..."}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[240px] overflow-hidden p-0" align="start">
          <Command>
            <CommandInput placeholder="搜索模版..." />
            <CommandList className="max-h-[50vh]">
              <CommandEmpty>无匹配模版</CommandEmpty>
              <CommandGroup>
                {initialTemplates.map((t) => {
                  const isSelected = templateIds.includes(t.id)
                  return (
                    <CommandItem
                      key={t.id}
                      value={t.name}
                      onSelect={() => toggleTemplate(t.id)}
                      className="py-2.5"
                    >
                      <Check className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{t.name}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">{t.template}</div>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((t) => (
            <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
              {t.name}
              <button
                type="button"
                className="ml-0.5 flex items-center justify-center rounded-full min-w-[20px] min-h-[20px] hover:bg-muted-foreground/20"
                onClick={() => toggleTemplate(t.id)}
                aria-label="移除模版"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      </CardContent>
    </Card>
  )
}
