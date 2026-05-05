import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Cursor-based pagination parameters
 * More efficient than offset-based for large datasets
 *
 * Usage in query string: ?cursor=abc123&limit=20
 * Response includes nextCursor for fetching next page
 */
export interface CursorPaginationParams {
  cursor?: string; // Base64 encoded identifier from previous page
  limit: number; // Items per page (default: 20, max: 100)
}

/**
 * Cursor-based pagination result
 */
export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null; // null if no more data
  hasMore: boolean;
  count: number; // Items in this page
}

/**
 * Helper to encode/decode cursor (base64)
 */
export class CursorHelper {
  /**
   * Encode identifier to cursor
   */
  static encodeCursor(id: string): string {
    return Buffer.from(id).toString('base64');
  }

  /**
   * Decode cursor to identifier
   */
  static decodeCursor(cursor: string): string {
    try {
      return Buffer.from(cursor, 'base64').toString('utf-8');
    } catch {
      throw new Error('Invalid cursor format');
    }
  }
}

/**
 * Pipe to parse and validate cursor pagination parameters
 *
 * Usage in controller:
 * @Query(CursorPaginationPipe) paging: CursorPaginationParams
 */
@Injectable()
export class CursorPaginationPipe
  implements PipeTransform<any, CursorPaginationParams>
{
  transform(value: any, metadata: ArgumentMetadata): CursorPaginationParams {
    const limit = Math.min(parseInt(value?.limit || '20'), 100); // Max 100 items per page

    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    return {
      cursor: value?.cursor,
      limit,
    };
  }
}

/**
 * Builder for cursor-based queries
 *
 * Example usage:
 * const builder = new CursorQueryBuilder(paging)
 *   .setCursorField('id')
 *   .setDefaultOrder({ id: 'asc' });
 *
 * const items = await db.serviceOrder.findMany(builder.build());
 * const result = builder.createResult(items);
 */
export class CursorQueryBuilder {
  private cursorField: string = 'id';
  private order: Record<string, 'asc' | 'desc'> = { id: 'asc' };
  private cursor?: string;
  private limit: number;

  constructor(params: CursorPaginationParams) {
    this.cursor = params.cursor;
    this.limit = params.limit;
  }

  /**
   * Set which field to use for cursor comparison (usually 'id')
   */
  setCursorField(field: string): this {
    this.cursorField = field;
    return this;
  }

  /**
   * Set sort order
   */
  setOrder(order: Record<string, 'asc' | 'desc'>): this {
    this.order = order;
    return this;
  }

  /**
   * Build Prisma query object to use with findMany()
   * Automatically handles cursor decoding and limits to limit+1 (to detect if hasMore)
   */
  build(): {
    take: number;
    skip?: number;
    cursor?: { id?: string };
    orderBy: Record<string, 'asc' | 'desc'>;
  } {
    const query: any = {
      take: this.limit + 1, // Fetch one extra to know if there are more
      orderBy: this.order,
    };

    // If cursor provided, start after that cursor
    if (this.cursor) {
      try {
        const cursorValue = CursorHelper.decodeCursor(this.cursor);
        query.cursor = { [this.cursorField]: cursorValue };
        query.skip = 1; // Skip the cursor item itself
      } catch (error) {
        // Invalid cursor, ignore and start from beginning
      }
    }

    return query;
  }

  /**
   * Transform fetched items into paginated result
   */
  createResult<T>(items: T[], getIdFn: (item: T) => string): CursorPaginationResult<T> {
    const hasMore = items.length > this.limit;
    const data = hasMore ? items.slice(0, -1) : items; // Remove extra item

    const nextCursor = hasMore
      ? CursorHelper.encodeCursor(getIdFn(data[data.length - 1]))
      : null;

    return {
      data,
      nextCursor,
      hasMore,
      count: data.length,
    };
  }
}

/**
 * Example: How to use cursor pagination in a controller
 *
 * @Get()
 * async list(
 *   @Query(CursorPaginationPipe) paging: CursorPaginationParams,
 * ) {
 *   const builder = new CursorQueryBuilder(paging)
 *     .setCursorField('id')
 *     .setOrder({ createdAt: 'desc', id: 'asc' });
 *
 *   const items = await this.prisma.serviceOrder.findMany(builder.build());
 *   return builder.createResult(items, (item) => item.id);
 * }
 *
 * Response:
 * {
 *   "data": [...],
 *   "nextCursor": "eyJpZCI6IjEyMyJ9",
 *   "hasMore": true,
 *   "count": 20
 * }
 */
