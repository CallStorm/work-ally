import type { NextConfig } from 'next';

const apiProxyTarget =
  process.env.API_PROXY_TARGET?.replace(/\/$/, '') || 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@work-ally/shared'],
  async rewrites() {
    // Same-origin /api → Nest, so LAN IP (e.g. http://9.x.x.x:3000) works without CORS pain.
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
