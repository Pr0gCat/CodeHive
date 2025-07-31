/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable TypeScript strict mode
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  // Allow build to succeed with ESLint warnings (for development ease)
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during builds to allow warnings
  },
  // Configure static file serving
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

export default nextConfig;
