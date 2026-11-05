import { obsoleteRevisionIds } from './revision-retention';
describe('Topology revision retention', () => {
  it('keeps the newest version when timestamps are equal', () => {
    const rows = Array.from({ length: 51 }, (_, version) => ({
      id: String(version),
      version,
      createdAt: new Date('2026-11-04'),
    }));
    expect(obsoleteRevisionIds(rows, new Date('2026-11-04'))).toEqual(['0']);
  });
  it('preserves the latest 50 and one older revision per month', () => {
    const recent = Array.from({ length: 60 }, (_, i) => ({
      id: `r${i}`,
      version: i + 4,
      createdAt: new Date(Date.UTC(2026, 10, 4, 0, i)),
    }));
    const rows = [
      ...recent,
      { id: 'oct1', version: 2, createdAt: new Date('2026-10-01') },
      { id: 'oct2', version: 3, createdAt: new Date('2026-10-02') },
      { id: 'ancient', version: 1, createdAt: new Date('2020-01-01') },
    ];
    const removed = obsoleteRevisionIds(rows, new Date('2026-11-04'));
    expect(removed).toContain('oct1');
    expect(removed).not.toContain('oct2');
    expect(removed).toContain('ancient');
    expect(removed.filter((id) => id.startsWith('r'))).toHaveLength(10);
  });
});
