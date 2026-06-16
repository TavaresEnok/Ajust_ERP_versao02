import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal do Cliente — Ajust ERP',
  description:
    'Acompanhe suas ordens de serviço, histórico de atendimento e pesquisas de satisfação.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Portal do Cliente — Ajust ERP',
    description: 'Acompanhe suas ordens de serviço em tempo real.',
    type: 'website',
  },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
