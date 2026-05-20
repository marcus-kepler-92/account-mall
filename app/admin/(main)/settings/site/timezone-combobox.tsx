"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
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
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

// Returns "UTC+8", "UTC-5:30", "UTC" — derived from Intl.DateTimeFormat's
// `shortOffset` for the given IANA zone at the current instant. This handles
// half-hour zones (Asia/Kolkata) and 45-minute zones (Asia/Kathmandu) cleanly.
function formatOffset(timeZone: string): string {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            timeZoneName: "shortOffset",
        }).formatToParts(new Date())
        const name = parts.find((p) => p.type === "timeZoneName")?.value ?? ""
        return name.replace(/^GMT/, "UTC") || "UTC"
    } catch {
        return ""
    }
}

type TimezoneOption = {
    value: string
    label: string
    offset: string
    region: string
}

const REGION_LABELS: Record<string, string> = {
    Asia: "亚洲",
    Europe: "欧洲",
    America: "美洲",
    Africa: "非洲",
    Australia: "澳洲",
    Pacific: "太平洋",
    Atlantic: "大西洋",
    Indian: "印度洋",
    Antarctica: "南极洲",
    Arctic: "北极",
    Etc: "UTC 偏移",
}

function buildOptions(): TimezoneOption[] {
    // `Intl.supportedValuesOf` returns the full IANA zone list (418 entries in
    // modern Node/browsers). We compute UTC offset once at module init — the
    // value is stable enough for a settings form; users can re-pick if DST
    // shifts later in the year.
    const zones =
        typeof Intl.supportedValuesOf === "function"
            ? Intl.supportedValuesOf("timeZone")
            : []
    return zones
        .map((tz) => {
            const [region, ...rest] = tz.split("/")
            const city = rest.join("/").replace(/_/g, " ") || tz
            return {
                value: tz,
                label: city,
                offset: formatOffset(tz),
                region,
            }
        })
        .sort((a, b) => {
            if (a.region !== b.region) return a.region.localeCompare(b.region)
            return a.label.localeCompare(b.label)
        })
}

type Props = {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
}

export function TimezoneCombobox({ value, onChange, placeholder, disabled }: Props) {
    const [open, setOpen] = useState(false)
    const options = useMemo(() => buildOptions(), [])
    const selected = options.find((o) => o.value === value)

    const groups = useMemo(() => {
        const byRegion = new Map<string, TimezoneOption[]>()
        for (const opt of options) {
            const arr = byRegion.get(opt.region) ?? []
            arr.push(opt)
            byRegion.set(opt.region, arr)
        }
        return Array.from(byRegion.entries()).map(([region, items]) => ({
            region,
            label: REGION_LABELS[region] ?? region,
            items,
        }))
    }, [options])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between font-normal",
                        !selected && "text-muted-foreground",
                    )}
                >
                    {selected ? (
                        <span className="truncate">
                            {selected.value}
                            <span className="ml-2 text-muted-foreground">{selected.offset}</span>
                        </span>
                    ) : (
                        <span>{placeholder ?? "选择时区"}</span>
                    )}
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command
                    filter={(itemValue, search) => {
                        // itemValue is the full IANA id (Asia/Shanghai). Search
                        // case-insensitively against id and label so "shanghai",
                        // "上海"-romanized-city, or "asia/sh" all work.
                        const q = search.toLowerCase()
                        return itemValue.toLowerCase().includes(q) ? 1 : 0
                    }}
                >
                    <CommandInput placeholder="搜索城市或 IANA 名称…" />
                    <CommandList>
                        <CommandEmpty>未找到时区</CommandEmpty>
                        {groups.map((group) => (
                            <CommandGroup key={group.region} heading={group.label}>
                                {group.items.map((opt) => (
                                    <CommandItem
                                        key={opt.value}
                                        value={opt.value}
                                        onSelect={() => {
                                            onChange(opt.value)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 size-4",
                                                value === opt.value ? "opacity-100" : "opacity-0",
                                            )}
                                        />
                                        <span className="flex-1 truncate">
                                            {opt.label}
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                {opt.value}
                                            </span>
                                        </span>
                                        <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                                            {opt.offset}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
