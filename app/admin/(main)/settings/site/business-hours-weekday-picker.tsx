"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

// JS Date.getDay() convention: 0=Sun ... 6=Sat. Labels match that order.
const LABELS = ["日", "一", "二", "三", "四", "五", "六"]

type Props = {
    value: string | null
    onChange: (next: string) => void
}

// Parses a JSON-array string of weekday indices (0–6) and renders a toggle row.
// Malformed JSON / non-array / out-of-range entries collapse to an empty selection,
// matching the lenient parsing in lib/site-settings.ts (which defaults to all days
// when persisted value is empty/null).
export function BusinessHoursWeekdayPicker({ value, onChange }: Props) {
    let selected: string[] = []
    try {
        const arr = JSON.parse(value && value.trim() !== "" ? value : "[]")
        if (Array.isArray(arr)) {
            selected = arr
                .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
                .map((n) => String(n))
        }
    } catch {
        selected = []
    }

    return (
        <ToggleGroup
            type="multiple"
            variant="outline"
            value={selected}
            onValueChange={(vals) => {
                const nums = Array.from(
                    new Set(
                        vals
                            .map((v) => Number(v))
                            .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
                    ),
                ).sort((a, b) => a - b)
                onChange(JSON.stringify(nums))
            }}
        >
            {LABELS.map((l, i) => (
                <ToggleGroupItem key={i} value={String(i)} aria-label={`星期${l}`}>
                    {l}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    )
}
