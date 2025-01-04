import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.vexels.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
