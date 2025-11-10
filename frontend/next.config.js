/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  // Проксирование API запросов через Vercel для обхода Mixed Content
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://53893873b619.vps.myjino.ru:4001';
    
    // Если указан полный URL, используем проксирование
    if (backendUrl.startsWith('http://') || backendUrl.startsWith('https://')) {
      return [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ];
    }
    
    // Если URL не указан или относительный, не используем проксирование
    return [];
  },
}

module.exports = nextConfig

