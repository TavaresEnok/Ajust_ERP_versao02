'use client';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useOperationalOrders } from '@/lib/erp/use-operational-orders';
import { buildAnalystOverview, ANALYST_TIMEZONE } from '@/lib/erp/analyst-workspace';
import { orderStatuses, type ErpRecord } from '@/lib/erp/contracts';
import { isDemonstration } from '@/lib/erp/management';
export function useStatusData(rows?: ErpRecord[]) {
  const query = useOperationalOrders('operation');
  return Object.entries(orderStatuses)
    .map(([status, name], index) => ({
      name,
      status,
      value: (rows || query.data || []).filter(
        (row) => !isDemonstration(row) && row.status === status,
      ).length,
      color: `var(--chart-${(index % 5) + 1})`,
    }))
    .filter((row) => row.value > 0);
}
export function VolumeChart({
  period = 'month',
  tenantId,
  rows: suppliedRows,
}: {
  period?: string;
  tenantId?: string;
  rows?: ErpRecord[];
}) {
  const query = useOperationalOrders('operation');
  const rows = (suppliedRows || query.data || []).filter(
    (row) => !isDemonstration(row) && (!tenantId || row.tenantId === tenantId),
  );
  const data = buildAnalystOverview(
    rows,
    period === 'week' ? 7 : period === 'quarter' ? 90 : 30,
    new Date(),
  ).series.map((row) => ({
    ...row,
    day: new Date(`${row.day}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
      timeZone: ANALYST_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
    }),
  }));
  return (
    <ChartContainer
      config={{
        opened: { label: 'Abertas', color: 'var(--chart-1)' },
        closed: { label: 'Concluídas', color: 'var(--chart-2)' },
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
            <stop offset="0%" stopColor="var(--color-opened)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--color-opened)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="var(--border)" />
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
export function StatusChart({
  rows,
  caption = 'ordens consultadas',
}: {
  rows?: ErpRecord[];
  caption?: string;
}) {
  const statusData = useStatusData(rows);
  const total = statusData.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="relative mx-auto w-[190px]">
      <ChartContainer
        config={{ value: { label: 'Ordens', color: 'var(--chart-1)' } }}
        className="h-[155px] w-[190px] aspect-auto"
      >
        <PieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
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
        <strong className="text-[29px] font-semibold tracking-tight">{total}</strong>
        <span className="text-[10px] text-muted-foreground">{caption}</span>
      </div>
    </div>
  );
}
export function Sparkline({ variant = 0 }: { variant?: number }) {
  const values: { v: number }[] = [];
  return (
    <ChartContainer
      config={{
        v: { color: variant === 2 ? 'var(--chart-3)' : 'var(--chart-1)' },
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
