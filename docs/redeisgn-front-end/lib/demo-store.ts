"use client";
import { useVisualCollection } from "./erp/visual-data";
import type { Order } from "./demo-data";
export { useVisualCollection as useDemoCollection } from "./erp/visual-data";
export function useOrders(endpoint?: string) {
  const [orders] = useVisualCollection<Order>("orders", [], endpoint);
  return { orders, addOrder: async (_order: Order) => { throw new Error("Utilize o formulário de criação do ERP."); }, updateOrder: async (_id: string, _changes: Partial<Order>) => { throw new Error("Utilize as operações com validação de versão do ERP."); } };
}
export function exportCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const safe = (v: string | number) => { const value = String(v); return /^[=+@\-\t\r]/.test(value) ? "'" + value : value; };
  const content = "\uFEFF" + [headers, ...rows].map(row => row.map(value => '"' + safe(value).replaceAll('"', '""') + '"').join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = name + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
