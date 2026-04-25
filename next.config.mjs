/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/relatorios/generate': ['./ref/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
    ],
  },
};

export default nextConfig;
