// Receipt uploads go from the browser straight to Vercel Blob (https://vercel.com/api/blob),
// so connect-src must allow it. NEXT_PUBLIC_VERCEL_BLOB_API_URL is only ever set for local
// testing against a stand-in server; it is unset in production.
const blobApiOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL ? new URL(process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL).origin : ''
  } catch {
    return ''
  }
})()

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
              ["connect-src 'self' https://api.postcodes.io https://nominatim.openstreetmap.org https://router.project-osrm.org",
                'https://vercel.com https://*.blob.vercel-storage.com', blobApiOrigin].filter(Boolean).join(' '),
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
