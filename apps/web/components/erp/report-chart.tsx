'use client';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { orderStatuses } from '@/lib/erp/contracts';

export interface ReportChartSpec {
  key?: string;
  title: string;
  category: string;
  series: { key: string; label: string }[];
}
export function ReportChart({ data, spec }: { data: unknown; spec: ReportChartSpec }) {
  if (!Array.isArray(data))
    return (
      <p className="px-6 pb-5 text-xs text-muted-foreground">
        O retorno ainda não contém a série {spec.title.toLowerCase()}.
      </p>
    );
  const rows = data
    .filter(
      (row): row is Record<string, unknown> =>
        !!row &&
        typeof row === 'object' &&
        typeof row[spec.category] === 'string' &&
        spec.series.every(
          (series) => typeof row[series.key] === 'number' && Number.isFinite(row[series.key]),
        ),
    )
    .map((row) => ({
      ...row,
      categoryLabel:
        orderStatuses[row[spec.category] as keyof typeof orderStatuses] || row[spec.category],
    }));
  if (!rows.length)
    return (
      <p className="px-6 pb-5 text-xs text-muted-foreground">
        Sem valores numéricos para este gráfico. Consulte a tabela de origem.
      </p>
    );
  const config = Object.fromEntries(
    spec.series.map((series, index) => [
      series.key,
      { label: series.label, color: `var(--chart-${(index % 5) + 1})` },
    ]),
  );
  return (
    <figure className="min-w-0 px-6 pb-6">
      <figcaption className="section-title mb-4">{spec.title}</figcaption>
      <ChartContainer config={config} className="h-64 w-full" aria-label={spec.title}>
        <BarChart
          accessibilityLayer
          data={rows}
          margin={{ top: 12, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="categoryLabel"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              String(value).length > 18 ? `${String(value).slice(0, 17)}…` : String(value)
            }
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {spec.series.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              fill={`var(--color-${series.key})`}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Valores do retorno filtrado do ERP. A tabela mantém os dados e rótulos completos.
      </p>
    </figure>
  );
}
