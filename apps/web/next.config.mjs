import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), display-capture=()',
  },
  // Isola a janela de abas abertas por outros sites (window.opener).
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // HSTS fica só no Caddy (borda), e a CSP com nonce dinâmico é emitida em apps/web/proxy.ts.
];

const nextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  ...(isDev
    ? {
        // Origens extras do servidor de desenvolvimento (ex.: IP da máquina) vêm do ambiente,
        // não do repositório: DEV_ALLOWED_ORIGINS="http://IP:8070,IP".
        allowedDevOrigins: [
          'localhost',
          '127.0.0.1',
          ...(process.env.DEV_ALLOWED_ORIGINS || '')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),
        ],
      }
    : {}),
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: '/drawio/:path*',
        destination: `${process.env.DRAWIO_INTERNAL_URL || 'http://drawio:8080'}/drawio/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/drawio/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
