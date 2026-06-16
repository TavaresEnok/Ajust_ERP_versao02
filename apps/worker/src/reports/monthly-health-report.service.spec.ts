import nodemailer from 'nodemailer';
import { MonthlyHealthReportService } from './monthly-health-report.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

function makePrisma(): any {
  return {
    tenant: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    serviceOrder: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('MonthlyHealthReportService', () => {
  const originalDate = Date;

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    global.Date = originalDate;
  });

  it('does not configure transport without SMTP', async () => {
    const service = new MonthlyHealthReportService(makePrisma());
    await service.onModuleInit();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('configures SMTP transport', async () => {
    process.env.SMTP_HOST = 'smtp.local';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: jest.fn() });
    const service = new MonthlyHealthReportService(makePrisma());

    await service.onModuleInit();

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.local',
      port: 465,
      secure: true,
      auth: { user: 'user', pass: 'pass' },
    });
  });

  it('skips monthly run outside first day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T12:00:00.000Z'));
    const prisma = makePrisma();
    const service = new MonthlyHealthReportService(prisma);
    await service.runCheck();
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });

  it('sends report once per active tenant and records audit marker', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    process.env.SMTP_HOST = 'smtp.local';
    process.env.SMTP_FROM = 'reports@ajust.local';
    const sendMail = jest.fn().mockResolvedValue({});
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    const prisma = makePrisma();
    prisma.tenant.findMany.mockResolvedValue([
      {
        id: 'tenant-1',
        legalName: 'Tenant',
        techContactEmail: 'tech@tenant.local',
      },
    ]);
    prisma.serviceOrder.findMany.mockResolvedValue([
      { status: 'FECHADA', priority: 'NORMAL' },
      { status: 'ABERTA', priority: 'CRITICA' },
    ]);
    const service = new MonthlyHealthReportService(prisma);
    await service.onModuleInit();

    await service.runCheck();

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'reports@ajust.local',
        to: 'tech@tenant.local',
        subject: expect.stringContaining('Saúde Operacional'),
        html: expect.stringContaining('50%'),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        action: 'EXPORT',
        resourceType: 'health_report_2026-6',
      }),
    });
  });

  it('skips tenant without email or already-sent report', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    const prisma = makePrisma();
    prisma.tenant.findMany.mockResolvedValue([
      { id: 'no-email', legalName: 'No email', techContactEmail: '' },
      { id: 'sent', legalName: 'Sent', techContactEmail: 'sent@tenant.local' },
    ]);
    prisma.auditLog.findFirst.mockResolvedValue({ id: 'existing' });
    const service = new MonthlyHealthReportService(prisma);

    await service.runCheck();

    expect(prisma.serviceOrder.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
