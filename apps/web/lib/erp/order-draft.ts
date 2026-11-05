'use client';
import { useMemo, useSyncExternalStore } from 'react';

type Evidence = Record<string, Record<string, string>>;
type Draft = {
  text: string;
  mode?: string;
  schedule: string;
  maintenance: boolean;
  impact: string;
  rollback: string;
  assignee: string;
  outcome: string;
  evidenceByStep: Evidence;
};
const empty: Draft = {
  text: '',
  schedule: '',
  maintenance: false,
  impact: '',
  rollback: '',
  assignee: '',
  outcome: '',
  evidenceByStep: {},
};
const memory = new Map<string, string>();
const changed = 'ajust-order-draft';
function subscribe(callback: () => void) {
  window.addEventListener(changed, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(changed, callback);
    window.removeEventListener('storage', callback);
  };
}
function read(key: string | null) {
  if (!key) return '';
  if (memory.has(key)) return memory.get(key)!;
  try {
    return sessionStorage.getItem(key) || memory.get(key) || '';
  } catch {
    return memory.get(key) || '';
  }
}
function parse(raw: string): Draft {
  if (!raw || raw.length > 600000) return empty;
  try {
    const saved = JSON.parse(raw);
    if (
      !saved ||
      typeof saved !== 'object' ||
      typeof saved.at !== 'number' ||
      !Number.isFinite(saved.at) ||
      Date.now() - saved.at > 86400000
    )
      return empty;
    const draft = { ...empty };
    for (const field of [
      'text',
      'schedule',
      'impact',
      'rollback',
      'assignee',
      'outcome',
      'mode',
    ] as const) {
      if (typeof saved.draft?.[field] === 'string')
        draft[field] = saved.draft[field].slice(0, 20000);
    }
    draft.maintenance = saved.draft?.maintenance === true;
    if (
      draft.mode &&
      !['start', 'finish', 'pause', 'resume', 'schedule', 'unschedule', 'assign'].includes(
        draft.mode,
      )
    )
      delete draft.mode;
    const evidence = saved.draft?.evidenceByStep;
    if (evidence && typeof evidence === 'object' && !Array.isArray(evidence)) {
      draft.evidenceByStep = Object.fromEntries(
        Object.entries(evidence)
          .filter(([, fields]) => fields && typeof fields === 'object' && !Array.isArray(fields))
          .map(([step, fields]) => [
            step,
            Object.fromEntries(
              Object.entries(fields as object).filter(([, value]) => typeof value === 'string'),
            ),
          ]),
      );
    }
    return draft;
  } catch {
    return empty;
  }
}
// Session storage keeps drafts in this tab, isolated by authenticated session and order.
// An unavailable browser store falls back to memory for navigation within the tab.
export function useOrderDraft(key: string | null) {
  const storageKey = key ? `ajust-order-draft:${key}` : null;
  const raw = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => '',
  );
  const draft = useMemo(() => parse(raw), [raw]);
  function setDraft(patch: Partial<Draft> | ((current: Draft) => Partial<Draft>)) {
    if (!storageKey) return;
    const current = parse(read(storageKey));
    const value = JSON.stringify({
      at: Date.now(),
      draft: { ...current, ...(typeof patch === 'function' ? patch(current) : patch) },
    });
    memory.set(storageKey, value);
    try {
      sessionStorage.setItem(storageKey, value);
    } catch {
      /* Keep the in-memory copy. */
    }
    window.dispatchEvent(new Event(changed));
  }
  function clearDraft() {
    if (!storageKey) return;
    memory.delete(storageKey);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* The memory copy is already cleared. */
    }
    window.dispatchEvent(new Event(changed));
  }
  return { draft, setDraft, clearDraft };
}
