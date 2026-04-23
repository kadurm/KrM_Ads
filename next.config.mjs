/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/relatorios/generate': ['./ref/**/*'],
  },
};

export default nextConfig;