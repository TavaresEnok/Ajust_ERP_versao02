'use client';

import nextDynamic from 'next/dynamic';
import { SkeletonDashboard } from '@/components/ui/skeleton';

const AnalistaPortal = nextDynamic(() => import('./portal'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <SkeletonDashboard />
      </div>
    </div>
  ),
});

export default function AnalistaPage() {
  return <AnalistaPortal />;
}
