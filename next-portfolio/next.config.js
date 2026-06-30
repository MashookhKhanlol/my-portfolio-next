/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker: emits a standalone server bundle (node server.js)
  output: 'standalone',
  experimental: {
    appDir: true,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: [
      'res.cloudinary.com',
      'img.icons8.com',
      'raw.githubusercontent.com',
      'i.imgur.com',
      'img.freepik.com',
      'media.geeksforgeeks.org',
      'skillicons.dev',
      'cdn.simpleicons.org',
      'images.unsplash.com',
    ]
  }
}

module.exports = nextConfig
