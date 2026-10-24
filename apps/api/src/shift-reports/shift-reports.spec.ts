import { ShiftReportsController, ReportInput } from './shift-reports.controller';
import { RequestWithAuth } from '../common/request-with-auth';
const req = (role = 'analista') =>
  ({ auth: { tenantId: 'ajust', userId: 'author', role } }) as unknown as RequestWithAuth;
describe('Shift reports', () => {
  const findMany = jest.fn().mockResolvedValue([]),
    findFirst = jest.fn().mockResolvedValue(null);
  const c = new ShiftReportsController({ shiftReport: { findMany, findFirst } } as never);
  beforeEach(() => jest.clearAllMocks());
  it.each(['#SGP-11952', ' SGP-11952 ', ' # SGP-11952 '])(
    'accepts displayed protocol %s',
    async (input) => {
      const orders = jest.fn().mockResolvedValue([]);
      const controller = new ShiftReportsController({
        serviceOrder: { findMany: orders },
      } as never);
      await controller.searchOrders(req(), input);
      expect(orders.mock.calls[0][0].where).toMatchObject({
        tenantId: 'ajust',
        deletedAt: null,
        OR: expect.arrayContaining([{ protocol: { contains: 'SGP-11952', mode: 'insensitive' } }]),
      });
    },
  );
  it('rejects an empty decorated protocol', () => {
    expect(() => c.searchOrders(req(), '# ')).toThrow();
  });
  it('denies customer access to list, details and authors', async () => {
    expect(() => c.list(req('cliente'), {})).toThrow();
    await expect(c.detail(req('cliente'), 'id')).rejects.toThrow();
    await expect(c.authors(req('cliente'))).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
  it('team lists only published reports in the authenticated company', async () => {
    await c.list(req(), {});
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: 'ajust',
      publishedAt: { not: null },
    });
  });
  it('personal scope cannot be changed by an author filter', async () => {
    await c.list(req(), { mine: 'true', author: 'fbe8431e-a25e-4c95-83fb-e3bf44ea3f30' });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      authorUserId: 'author',
      tenantId: 'ajust',
    });
  });
  it('details allow own drafts or team publications, never another company', async () => {
    await expect(c.detail(req(), 'id')).rejects.toThrow();
    expect(findFirst.mock.calls[0][0].where).toEqual({
      id: 'id',
      tenantId: 'ajust',
      OR: [{ authorUserId: 'author' }, { publishedAt: { not: null } }],
    });
  });
  it('accepts a date without any start/end times and rejects invalid dates', () => {
    const input = {
      shift: 'NIGHT',
      referenceDate: '2026-10-22',
      content: 'Relato do expediente noturno',
    };
    expect(ReportInput.safeParse(input).success).toBe(true);
    expect(ReportInput.safeParse({ ...input, referenceDate: '2026-02-30' }).success).toBe(false);
    expect(ReportInput.safeParse({ ...input, content: 'curto' }).success).toBe(false);
  });
  it('paginates on the database with stable ordering even for the 1000th record', async () => {
    await c.list(req(), { offset: 950 });
    expect(findMany.mock.calls[0][0]).toMatchObject({
      take: 50,
      skip: 950,
      orderBy: [{ referenceDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('content');
  });
});
