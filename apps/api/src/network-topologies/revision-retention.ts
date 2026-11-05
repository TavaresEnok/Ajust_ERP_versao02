/** Keep the latest 50 revisions and one snapshot per UTC month for the preceding 24 months. */
export function obsoleteRevisionIds(
  rows: Array<{ id: string; createdAt: Date; version: number }>,
  now = new Date(),
) {
  const newest = [...rows].sort((a, b) => b.version - a.version);
  const keep = new Set(newest.slice(0, 50).map((row) => row.id));
  const months = new Set<string>();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 23, 1));
  for (const row of newest) {
    const month = row.createdAt.toISOString().slice(0, 7);
    if (row.createdAt >= cutoff && !months.has(month)) {
      keep.add(row.id);
      months.add(month);
    }
  }
  return newest.filter((row) => !keep.has(row.id)).map((row) => row.id);
}
