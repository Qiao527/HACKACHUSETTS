/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // In development, proxy /api/* to the local FastAPI server on :8000.
    // In production on Vercel, /api/* is served by the Python function directly,
    // so no rewrite is applied.
    if (process.env.NODE_ENV === 'development') {
      return [{ source: '/api/:path*', destination: 'http://127.0.0.1:8000/api/:path*' }];
    }
    return [];
  },
};

module.exports = nextConfig;
