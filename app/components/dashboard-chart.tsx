"use client"

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts"

type ChartData = {
    date: string
    订单: number
    营收: number
}

export function DashboardChart({ data }: { data: ChartData[] }) {
    return (
        <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="营收"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.2)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
