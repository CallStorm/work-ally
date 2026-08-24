import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@work-ally/shared'],
  // /api/* is proxied by app/api/[...path]/route.ts (retry + clearer errors).
};

export default nextConfig;
