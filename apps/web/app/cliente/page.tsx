'use client';

import nextDynamic from 'next/dynamic';

const ClientePortal = nextDynamic(() => import('./portal'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 text-gray-500">
      Carregando portal Cliente...
    </div>
  ),
});

export default function ClientePage() {
  return <ClientePortal />;
}
