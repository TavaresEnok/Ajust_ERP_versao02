'use client';

import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-100 dark:bg-gray-800', className)}
      {...props}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonKPIRow({ count = 5 }: { count?: number }) {
  return (
    <div className={cn('grid gap-4', `grid-cols-${Math.min(count, 5)}`)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-4 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] overflow-hidden">
      <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-3">
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="divide-y divide-[rgba(0,0,0,0.06)]">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 px-5 py-3">
            {Array.from({ length: cols }).map((_, col) => (
              <Skeleton
                key={col}
                className={cn('h-3', col === 0 ? 'w-24' : col === cols - 1 ? 'w-16' : 'flex-1')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <SkeletonKPIRow count={5} />
      <SkeletonCard lines={4} />
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}

export { Skeleton };
