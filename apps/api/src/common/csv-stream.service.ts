import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';

/**
 * CSV Streaming Service for memory-efficient large exports
 *
 * Instead of building entire CSV in memory, stream it directly to client
 * Prevents memory bloat and timeouts on large datasets (10k+ rows)
 *
 * Example usage:
 * const csvService = new CsvStreamService();
 * await csvService.streamCsv(
 *   res,
 *   'service-orders',
 *   ['id', 'title', 'status', 'createdAt'],
 *   async (writeRow) => {
 *     const items = await db.serviceOrder.findMany();
 *     for (const item of items) {
 *       writeRow(item);
 *     }
 *   }
 * );
 */
@Injectable()
export class CsvStreamService {
  private readonly logger = new Logger(CsvStreamService.name);

  /**
   * Stream CSV data to HTTP response
   *
   * @param res - Express response object
   * @param fileName - File name without .csv extension
   * @param columns - Array of column names (also keys in data objects)
   * @param dataSource - Async function that calls writeRow for each row
   * @param chunkSize - Buffer size before flushing (default 1000 rows)
   */
  async streamCsv<T extends Record<string, any>>(
    res: Response,
    fileName: string,
    columns: (keyof T)[],
    dataSource: (
      writeRow: (data: T) => void,
      stats: { rowsWritten: number },
    ) => Promise<void>,
    chunkSize: number = 1000,
  ): Promise<void> {
    const csvFileName = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${csvFileName}"`,
    );
    res.setHeader('Transfer-Encoding', 'chunked');

    const columnNames = columns.map((col) => String(col));
    let buffer: string[] = [];
    let rowCount = 0;

    // Write BOM for proper UTF-8 encoding in Excel
    res.write('\ufeff');

    // Write header row
    const headerRow = this.escapeCsvRow(columnNames);
    res.write(headerRow + '\n');

    const writeRow = (data: T): void => {
      const values = columnNames.map((col) => {
        const value = data[col];
        return this.formatCsvValue(value);
      });

      buffer.push(this.escapeCsvRow(values));
      rowCount++;

      // Flush buffer when chunk size reached
      if (buffer.length >= chunkSize) {
        res.write(buffer.join('\n') + '\n');
        buffer = [];
      }
    };

    try {
      // Execute data source to populate CSV
      await dataSource(writeRow, { rowsWritten: rowCount });

      // Flush remaining buffer
      if (buffer.length > 0) {
        res.write(buffer.join('\n') + '\n');
      }

      this.logger.log(
        `CSV stream completed: ${csvFileName} (${rowCount} rows)`,
      );
      res.end();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`CSV stream error: ${message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate CSV' });
      } else {
        res.end();
      }
    }
  }

  /**
   * Stream paginated data efficiently
   * Useful for exporting results from paginated queries
   */
  async streamPaginatedCsv<T extends Record<string, any>>(
    res: Response,
    fileName: string,
    columns: (keyof T)[],
    pageSize: number,
    dataFetcher: (page: number, size: number) => Promise<T[]>,
  ): Promise<void> {
    let pageNumber = 0;
    const columnNames = columns.map((col) => String(col));
    let totalRows = 0;

    await this.streamCsv(
      res,
      fileName,
      columns,
      async (writeRow) => {
        let hasMore = true;

        while (hasMore) {
          const items = await dataFetcher(pageNumber, pageSize);

          if (items.length === 0) {
            hasMore = false;
          } else {
            for (const item of items) {
              writeRow(item);
              totalRows++;
            }

            // If less than page size returned, this was the last page
            if (items.length < pageSize) {
              hasMore = false;
            }
          }

          pageNumber++;
        }
      },
      pageSize,
    );
  }

  /**
   * Format CSV value (escaping quotes and handling null/undefined)
   */
  private formatCsvValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Convert dates to ISO string
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Convert objects to JSON
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    // Convert boolean to text
    if (typeof value === 'boolean') {
      return value ? 'Sim' : 'Não';
    }

    return String(value);
  }

  /**
   * Escape CSV row (handle commas, quotes, newlines)
   * Per RFC 4180: https://tools.ietf.org/html/rfc4180
   */
  private escapeCsvRow(values: string[]): string {
    return values
      .map((value) => {
        // If value contains comma, quote, or newline, wrap in quotes
        if (
          value.includes(',') ||
          value.includes('"') ||
          value.includes('\n') ||
          value.includes('\r')
        ) {
          // Escape internal quotes by doubling them
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',');
  }

  /**
   * Generate CSV as string (for small datasets only)
   * Do NOT use for large datasets - use streamCsv instead
   */
  generateCsvString<T extends Record<string, any>>(
    columns: (keyof T)[],
    data: T[],
  ): string {
    const columnNames = columns.map((col) => String(col));

    // Header row
    const rows: string[] = [this.escapeCsvRow(columnNames)];

    // Data rows
    for (const item of data) {
      const values = columnNames.map((col) =>
        this.formatCsvValue(item[col]),
      );
      rows.push(this.escapeCsvRow(values));
    }

    return rows.join('\n');
  }
}

/**
 * Example controller usage:
 *
 * @Get('export')
 * async exportServiceOrders(
 *   @Res() res: Response,
 * ) {
 *   return await this.csvService.streamCsv(
 *     res,
 *     'service-orders-export',
 *     ['id', 'title', 'status', 'clientName', 'createdAt'],
 *     async (writeRow) => {
 *       const items = await this.serviceOrders.findMany({
 *         where: { deletedAt: null },
 *         include: { client: true },
 *       });
 *
 *       for (const item of items) {
 *         writeRow({
 *           id: item.id,
 *           title: item.title,
 *           status: item.status,
 *           clientName: item.client.name,
 *           createdAt: item.createdAt,
 *         });
 *       }
 *     },
 *     2000, // 2000 rows per chunk
 *   );
 * }
 */
