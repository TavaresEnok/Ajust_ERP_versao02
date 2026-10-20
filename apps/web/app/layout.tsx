import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { headers } from 'next/headers';
import { parseScope, SCOPE_HEADER } from '@/lib/bff/scope';
import { ErpSessionProvider } from '@/lib/erp/session-provider';

const themeScript = `(function(){try{var t=document.cookie.match(/(?:^|; )ajust-theme=(light|dark)(?:;|$)/);var d=t?t[1]==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})()`;

export const metadata: Metadata = {
  title: 'Ajust ERP · Gestão que conecta',
  description:
    'Ajust ERP: gestão operacional de ordens, ocorrências, SLA, mudanças, processos e equipes. Frontend preparado para integração com os serviços originais.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#08090b' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const scope = parseScope((await headers()).get(SCOPE_HEADER));
  return (
    <html lang="pt-BR" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ErpSessionProvider scope={scope}>{children}</ErpSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
