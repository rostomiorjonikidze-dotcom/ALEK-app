import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/deshboard", destination: "/dashboard", permanent: true },
      { source: "/welcom", destination: "/welcome", permanent: true },
    ];
  },
};

export default nextConfig;
