/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiTarget = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3333';
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget.replace(/\/$/, '')}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

