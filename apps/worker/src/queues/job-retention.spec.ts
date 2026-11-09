import { Queue } from 'bullmq';
import { QueueSchedulerService } from './queue-scheduler.service';
import { JOB_RETENTION, jobInterval } from './job-retention';
jest.mock('bullmq', () => ({ Queue: jest.fn() }));

describe('Recurring job retention', () => {
  it('sets retention on every schedule including existing recurring jobs', async () => {
    const schedule = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    (Queue as unknown as jest.Mock).mockImplementation(() => ({
      upsertJobScheduler: schedule,
      close,
    }));
    const service = new QueueSchedulerService();
    await service.onModuleInit();
    expect(schedule).toHaveBeenCalledTimes(6);
    for (const [, , template] of schedule.mock.calls)
      expect(template.opts).toEqual(expect.objectContaining(JOB_RETENTION));
    await service.onModuleDestroy();
    expect(close).toHaveBeenCalledTimes(6);
  });

  it('rejects invalid intervals before registering a recurring job', () => {
    const name = 'TEST_JOB_INTERVAL_MS';
    try {
      for (const value of ['NaN', '-1', '0', '0.5', 'Infinity']) {
        process.env[name] = value;
        expect(() => jobInterval(name, 1000)).toThrow();
      }
      delete process.env[name];
      expect(jobInterval(name, 60_000)).toBe(60_000);
    } finally {
      delete process.env[name];
    }
  });
});
