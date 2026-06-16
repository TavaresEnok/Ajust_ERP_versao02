'use client';
import dynamic from 'next/dynamic';

const ManagerPortal = dynamic(() => import('../gerencia/portal'), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center">Loading...</div>,
});

export default function VerifyManagerPage() {
  return <ManagerPortal />;
}
