import './globals.css';
import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { ReactNode } from 'react';

const titleFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-title',
  weight: ['400', '500', '700']
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700']
});

export const metadata: Metadata = {
  title: 'Ajust ERP',
  description: 'ERP para operacao de provedores e consultoria'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${titleFont.variable} ${monoFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
