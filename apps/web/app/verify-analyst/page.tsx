'use client';
import dynamic from 'next/dynamic';

const AnalystMockup = dynamic(() => import('../mockups/analista-mockup'), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center">Loading...</div>
});

export default function VerifyAnalystPage() {
    return <AnalystMockup />;
}
