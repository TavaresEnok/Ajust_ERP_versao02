import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

type WorkerRequest = {
  headers: {
    authorization?: string | string[];
  };
};

@Injectable()
export class WorkerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WorkerRequest>();
    const expected = process.env.WORKER_API_TOKEN;
    const received = request.headers.authorization;

    if (!expected || typeof received !== 'string') {
      throw new UnauthorizedException('Invalid worker token.');
    }

    const left = Buffer.from(received, 'utf8');
    const right = Buffer.from(`Bearer ${expected}`, 'utf8');
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('Invalid worker token.');
    }

    return true;
  }
}
