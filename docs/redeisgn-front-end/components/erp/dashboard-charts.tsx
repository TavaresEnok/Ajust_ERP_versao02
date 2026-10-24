"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useVisualSource } from "@/lib/erp/visual-data";
import { orderStatuses } from "@/lib/erp/contracts";
function periodStart(period: string) { const date = new Date(); if (period === "week") date.setDate(date.getDate() - 6); else if (period === "quarter") date.setMonth(date.getMonth() - 3); else date.setDate(1); date.setHours(0, 0, 0, 0); return date; }
export function useStatusData() {
  const query = useVisualSource("orders");
  return Object.entries(orderStatuses).map(([status, name], index) => ({ name, value: query.raw.filter(row => row.status === status).length, color: `var(--chart-${index % 5 + 1})` })).filter(row => row.value > 0);
}
export function VolumeChart({ period = "month", tenantId }: { period?: string; tenantId?: string }) {
  const query = useVisualSource("orders");
  const start = periodStart(period);
  const groups = new Map<string, { day: string; opened: number; closed: number }>();
  query.raw.filter(row => !tenantId || row.tenantId === tenantId).forEach(row => {
    const created = new Date(String(row.createdAt));
    if (!Number.isFinite(created.getTime()) || created < start) return;
    const key = created.toISOString().slice(0, 10);
    const group = groups.get(key) || { day: created.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), opened: 0, closed: 0 };
    group.opened += 1;
    if (["RESOLVIDA", "FECHADA"].includes(String(row.status))) group.closed += 1;
    groups.set(key, group);
  });
  const data = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
  return (
    <ChartContainer
      config={{
        opened: { label: "Abertas", color: "var(--chart-1)" },
        closed: { label: "Concluídas", color: "var(--chart-2)" },
      }}
      className="h-[214px] w-full aspect-auto"
    >
      <AreaChart
        data={data}
        margin={{ top: 15, right: 10, left: -22, bottom: 0 }}
        accessibilityLayer
      >
        <defs>
          <linearGradient id="openedFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-opened)"
              stopOpacity={0.12}
            />
            <stop
              offset="100%"
              stopColor="var(--color-opened)"
              stopOpacity={0.01}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 4"
          stroke="var(--border)"
        />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tickMargin={13}
          minTickGap={20}
          tick={{ fontSize: 9 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          tickCount={5}
          tick={{ fontSize: 9 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="closed"
          stroke="var(--color-closed)"
          fill="transparent"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        <Area
          type="monotone"
          dataKey="opened"
          stroke="var(--color-opened)"
          strokeWidth={2.4}
          fill="url(#openedFill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
export function StatusChart() {
  const statusData = useStatusData();
  const total = statusData.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="relative mx-auto w-[190px]">
      <ChartContainer
        config={{ value: { label: "Ordens", color: "var(--chart-1)" } }}
        className="h-[155px] w-[190px] aspect-auto"
      >
        <PieChart accessibilityLayer>
          <ChartTooltip
            content={<ChartTooltipContent nameKey="name" hideLabel />}
          />
          <Pie
            data={statusData}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={71}
            startAngle={90}
            endAngle={-270}
            paddingAngle={4}
            cornerRadius={3}
            strokeWidth={0}
          >
            {statusData.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <strong className="text-[29px] font-semibold tracking-tight">{total || "—"}</strong>
        <span className="text-[10px] text-muted-foreground">ordens consultadas</span>
      </div>
    </div>
  );
}
export function Sparkline({ variant = 0 }: { variant?: number }) {
  const values: { v: number }[] = [];
  return (
    <ChartContainer
      config={{
        v: { color: variant === 2 ? "var(--chart-3)" : "var(--chart-1)" },
      }}
      className="h-[33px] w-[85px] aspect-auto"
      aria-hidden="true"
    >
      <AreaChart data={values}>
        <Area
          dataKey="v"
          type="monotone"
          stroke="var(--color-v)"
          strokeWidth={1.5}
          fill="var(--color-v)"
          fillOpacity={0.05}
        />
      </AreaChart>
    </ChartContainer>
  );
}
