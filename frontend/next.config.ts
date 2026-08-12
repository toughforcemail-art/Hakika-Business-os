import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.100.110"],
  images: { remotePatterns: [] },
};
export default nextConfig;
