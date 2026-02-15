import type { NextConfig } from "next";

const appHost =
  typeof process.env.VERCEL_URL === "string"
    ? process.env.VERCEL_URL.replace(/^https?:\/\//, "").split("/")[0]
    : "localhost";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: appHost, pathname: "/**" },
      { protocol: "http", hostname: "localhost", pathname: "/**" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
