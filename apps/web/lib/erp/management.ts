import type { ErpRecord } from './contracts';

export function isDemonstration(row: ErpRecord) {
  const metadata = row.sourceMetadata;
  return Boolean(
    metadata &&
    typeof metadata === 'object' &&
    'demonstration' in metadata &&
    metadata.demonstration === true,
  );
}

export interface ManagementOverview {
  generatedAt: string;
  period: { start: string; end: string; days: number; timeZone: string };
  population: { excludedDemonstrations: number; scope: string };
  operation: {
    totalOpen: number;
    overdue: number;
    dueSoon: number;
    paused: number;
    unassigned: number;
    scheduled: number;
    withoutSla: number;
  };
  results: {
    opened: number;
    closed: number;
    tmrHours: number | null;
    measuredClosed: number;
    slaPercentage: number | null;
    slaEvaluated: number;
    slaMet: number;
    missingCompletionDate: number;
  };
  team: {
    id: string;
    userId: string | null;
    name: string;
    open: number;
    closed: number;
    slaBreaches: number;
    paused: number;
    measuredClosed: number;
    tmrHours: number | null;
  }[];
}
