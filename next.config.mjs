/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@react-pdf/renderer'],

  experimental: {
    staleTimes: {
      dynamic: 0,  // Never cache dynamic pages on the client
      static: 180,
    },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // @react-pdf/renderer uses eval() internally for PDF generation.
            // This is a private single-user app so unsafe-eval is acceptable.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.postcodes.io https://nominatim.openstreetmap.org https://router.project-osrm.org",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
