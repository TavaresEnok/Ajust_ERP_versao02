/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // Limita origens que podem acionar o dev server (CVE dev exposure em versões antigas do Next 15).
  ...(isDev
    ? {
        allowedDevOrigins: [
          'localhost',
          '127.0.0.1',
          'http://SERVIDOR_IP:8070',
          'SERVIDOR_IP'
        ]
      }
    : {}),
  // Keep dev and production artifacts separated so a local `next build`
  // does not corrupt the running `next dev` server.
  distDir: isDev ? '.next-dev' : '.next',
  output: 'standalone',
  typedRoutes: true
};

export default nextConfig;
