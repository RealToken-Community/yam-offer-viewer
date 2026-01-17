/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    // NEXT_PUBLIC_COMMUNITY_API_URI: process.env.NEXT_PUBLIC_COMMUNITY_API_URI,
    // NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'realt.co',
      },
      // {
      //   protocol: 'https',
      //   hostname: 'api.realtoken.community',
      // }
    ]
  },
}

module.exports = nextConfig