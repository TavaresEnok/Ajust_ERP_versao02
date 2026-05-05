'use client';
import dynamic from 'next/dynamic';

const ManagerMockup = dynamic(() => import('../mockups/gerencia-mockup'), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center">Loading...</div>
});

export default function VerifyManagerPage() {
    return <ManagerMockup />;
}
