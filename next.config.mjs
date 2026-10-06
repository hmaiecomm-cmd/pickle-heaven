/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // libSQL/Turso 含原生模組，交給 Node 直接 require，不要讓 webpack 打包。
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-libsql', '@libsql/client', 'libsql'],
  poweredByHeader: false,
  async redirects() {
    // 原 /owner 後台已併入 /admin
    return [
      { source: '/owner', destination: '/admin', permanent: true },
      { source: '/owner/dashboard', destination: '/admin', permanent: true },
      { source: '/owner/reservations', destination: '/admin/bookings', permanent: true },
      { source: '/owner/smart-court', destination: '/admin/ai-courts', permanent: true },
      { source: '/owner/:path*', destination: '/admin/:path*', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        // LIFF runs inside an in-app browser / iframe hosted by LINE.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ]
  },
}
export default nextConfig
