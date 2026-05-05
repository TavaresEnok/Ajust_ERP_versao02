'use client';

import nextDynamic from 'next/dynamic';

const GerenciaMockup = nextDynamic(() => import('../mockups/gerencia-mockup'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 text-gray-500">
      Carregando portal Gerência...
    </div>
  )
});


export default function GerenciaPage() {
  return <GerenciaMockup />;
}

