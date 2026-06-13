import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
  },
  productionBrowserSourceMaps: true,
};

export default nextConfig;
