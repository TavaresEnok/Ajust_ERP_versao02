import { UnauthorizedException } from '@nestjs/common';
import { WorkerAuthGuard } from './worker-auth.guard';

function context(authorization?: string | string[]): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  };
}

describe('WorkerAuthGuard', () => {
  const guard = new WorkerAuthGuard();

  afterEach(() => {
    delete process.env.WORKER_API_TOKEN;
  });

  it('allows exact bearer token', () => {
    process.env.WORKER_API_TOKEN = 'worker-secret';
    expect(guard.canActivate(context('Bearer worker-secret'))).toBe(true);
  });

  it.each([undefined, 'Bearer wrong', ['Bearer worker-secret']])(
    'rejects invalid authorization value %p',
    (authorization) => {
      process.env.WORKER_API_TOKEN = 'worker-secret';
      expect(() => guard.canActivate(context(authorization))).toThrow(UnauthorizedException);
    },
  );

  it('rejects when expected token is not configured', () => {
    expect(() => guard.canActivate(context('Bearer worker-secret'))).toThrow(UnauthorizedException);
  });
});
