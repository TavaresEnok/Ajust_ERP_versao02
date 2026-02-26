/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // Keep dev and production artifacts separated so a local `next build`
  // does not corrupt the running `next dev` server.
  distDir: isDev ? '.next-dev' : '.next',
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
