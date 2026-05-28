import type { NextConfig } from 'next'

const apiOrigin = process.env.API_PROXY_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL

const apiRewriteSources = [
  '/auth/login',
  '/auth/logout',
  '/auth/me',
  '/auth/refresh',
  '/billing/:path*',
  '/github/:path*',
  '/pull-requests/:path*',
  '/onboarding/signup',
]

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiOrigin) return []

    return apiRewriteSources.map((source) => ({
      source,
      destination: `${apiOrigin}${source}`,
    }))
  },
}

export default nextConfig
