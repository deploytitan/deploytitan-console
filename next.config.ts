import type { NextConfig } from "next";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL;

type ApiRewriteSource =
  | {
      source: string;
      destination: string;
    }
  | string;

const apiRewriteSources: ApiRewriteSource[] = [
  {
    source: "/api/github/install/callback",
    destination: `${apiOrigin}/github/install/callback`,
  },
  "/auth/login",
  "/auth/logout",
  "/auth/me",
  "/auth/refresh",
  "/billing/:path*",
  "/github/:path*",
  "/pull-requests/:path*",
  "/release-packets/:path*",
  "/onboarding/signup",
];

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
  },
  productionBrowserSourceMaps: true,
  async rewrites() {
    if (!apiOrigin) return [];

    return apiRewriteSources.map((source) => {
      if (typeof source === "string") {
        return {
          source,
          destination: `${apiOrigin}${source}`,
        };
      }
      return source;
    });
  },
};

export default nextConfig;
