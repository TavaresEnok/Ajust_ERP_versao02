/**
 * Tipos das linhas visuais do redesign. Os antigos arrays de exemplo foram removidos:
 * toda informação exibida vem do ERP (ver lib/erp/visual-data.ts).
 */
export type Order = {
  id: string;
  protocol?: string;
  title: string;
  provider: string;
  initials: string;
  analyst: string;
  status: string;
  priority: string;
  type: string;
  date: string;
  deadline: string;
  description: string;
};

export type ProviderRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  city: string;
  orders: string | number;
  active: string | number;
  sla: string | number;
  status: string;
  color?: string;
};

export type TechnicianRow = {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  active: string | number;
  done: string | number;
  sla: string | number;
  status: string;
};
