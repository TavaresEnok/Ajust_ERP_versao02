import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, auth, ip, headers } = req;

    return next.handle().pipe(
      mergeMap(async (response: unknown) => {
        // Log changes (POST, PATCH, PUT, DELETE)
        if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
          const tenantId = auth?.tenantId;
          const userId = auth?.userId;

          if (tenantId && userId) {
            const { resourceType, resourceId, action } = this.parseRequest(url, method, body);
            const userAgent = headers['user-agent'] || 'unknown';
            const clientIp = ip || headers['x-forwarded-for'] || 'unknown';
            const statusCode =
              typeof response === 'object' &&
              response !== null &&
              'statusCode' in response &&
              typeof (response as { statusCode?: unknown }).statusCode === 'number'
                ? (response as { statusCode: number }).statusCode
                : 200;

            try {
              await this.prisma.auditLog.create({
                data: {
                  tenantId,
                  actorUserId: userId,
                  action: action as AuditAction,
                  resourceType,
                  resourceId,
                  ip: clientIp,
                  userAgent,
                  metadata: {
                    method,
                    url,
                    statusCode,
                    body: this.sanitizeBody(body),
                  } as Prisma.InputJsonValue,
                },
              });
              if (process.env.NODE_ENV === 'development') {
                console.log(
                  `[AUDIT] ${action} | User: ${userId} | Resource: ${resourceType}/${resourceId || '-'}`,
                );
              }
            } catch (error) {
              const err = error as Error;
              console.error(`[AUDIT ERROR] Failed to log audit: ${err.message}`);
            }
          }
        }
        return response;
      }),
    );
  }

  private parseRequest(
    url: string,
    method: string,
    body: unknown,
  ): { resourceType: string; resourceId?: string; action: AuditAction } {
    const [pathOnly] = String(url || '').split('?');
    const urlParts = pathOnly.split('/').filter(Boolean);
    const resource = urlParts[0] || 'unknown';

    let resourceId: string | undefined;
    if (resource === 'service-orders') {
      if (urlParts[1] && !['summary', 'export', 'occurrences'].includes(urlParts[1])) {
        resourceId = urlParts[1];
      } else if (urlParts[1] === 'occurrences' && urlParts[2]) {
        resourceId = urlParts[2];
      }
    } else if (
      (resource === 'iam' && urlParts[1] === 'users' && urlParts[2]) ||
      (resource === 'knowledge' && urlParts[2])
    ) {
      resourceId = urlParts[2];
    } else {
      resourceId = urlParts[1];
    }

    let action: AuditAction = 'OS_UPDATE';

    if (resource === 'auth') {
      if (pathOnly.includes('/login')) action = 'LOGIN';
      else if (pathOnly.includes('/logout')) action = 'LOGOUT';
      else action = 'OS_UPDATE';
      return { resourceType: resource, resourceId, action };
    }

    if (resource === 'service-orders') {
      if (method === 'POST') {
        action = urlParts.length === 1 || urlParts[1] === 'occurrences' ? 'OS_CREATE' : 'OS_UPDATE';
      } else if (method === 'DELETE') {
        action = 'OS_CANCEL';
      } else if (method === 'PATCH' && urlParts[2] === 'transition') {
        const toStatus =
          typeof body === 'object' && body !== null && 'toStatus' in body
            ? String((body as { toStatus?: unknown }).toStatus || '')
            : '';
        if (toStatus === 'FECHADA') action = 'OS_CLOSE';
        else if (toStatus === 'CANCELADA') action = 'OS_CANCEL';
        else action = 'OS_UPDATE';
      } else {
        action = 'OS_UPDATE';
      }
      return { resourceType: resource, resourceId, action };
    }

    if (resource === 'iam') {
      if (urlParts[1] === 'users') {
        if (method === 'POST') action = 'CREATE_USER';
        else if (method === 'PATCH') action = 'UPDATE_USER';
        else if (method === 'DELETE') action = 'DELETE_USER';
        else action = 'ROLE_CHANGE';
      } else if (urlParts[1] === 'tenants') {
        if (method === 'POST') action = 'CREATE_TENANT';
        else if (method === 'PATCH') action = 'UPDATE_TENANT';
      } else if (pathOnly.includes('/sla')) {
        action = 'SLA_CHANGE';
      }
      return { resourceType: resource, resourceId, action };
    }

    if (resource === 'knowledge' && pathOnly.includes('/credentials')) {
      return { resourceType: resource, resourceId, action: 'CREDENTIAL_ACCESS' };
    }

    if (method === 'DELETE') action = 'EXPORT';
    else if (method === 'POST') action = 'OS_CREATE';
    return { resourceType: resource, resourceId, action };
  }

  private sanitizeBody(body: unknown): Record<string, unknown> {
    const sanitized = this.sanitizeValue(body);
    return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
      ? (sanitized as Record<string, unknown>)
      : {};
  }

  private sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item));
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        /(password|token|secret|api.?key|authorization|credential)/i.test(key)
          ? '[REDACTED]'
          : this.sanitizeValue(item),
      ]),
    );
  }
}
