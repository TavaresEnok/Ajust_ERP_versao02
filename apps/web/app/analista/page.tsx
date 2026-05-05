'use client';

import nextDynamic from 'next/dynamic';

const AnalistaMockup = nextDynamic(() => import('../mockups/analista-mockup'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 text-gray-500">
      Carregando portal Analista...
    </div>
  )
});


export default function AnalistaPage() {
  return <AnalistaMockup />;
}

