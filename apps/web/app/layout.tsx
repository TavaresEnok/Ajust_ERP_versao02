import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ReactNode } from 'react';

const appFont = Inter({
  subsets: ['latin'],
  variable: '--font-app',
  weight: ['400', '500', '600', '700'],
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Ajust ERP',
  description: 'ERP para operacao de provedores e consultoria',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${appFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>
  );
}
