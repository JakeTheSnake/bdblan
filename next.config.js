/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serve the whole app under /bdb. Keep in sync with BASE_PATH in lib/basePath.js.
  basePath: '/bdb',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.cloudflare.steamstatic.com' },
      { protocol: 'https', hostname: 'cdn.akamai.steamstatic.com' },
      { protocol: 'https', hostname: 'steamcdn-a.akamaihd.net' },
      { protocol: 'https', hostname: 'api.opendota.com' },
    ],
  },
  allowedDevOrigins: ['192.168.1.24'],
  // Dev convenience: the app lives under /bdb, so a bare / would 404.
  // Redirect it to /bdb. `basePath: false` matches the literal root path
  // instead of /bdb/. In production a reverse proxy is expected to route.
  async redirects() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/',
        destination: '/bdb',
        basePath: false,
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
