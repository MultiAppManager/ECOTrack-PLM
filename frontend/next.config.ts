import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  images: {
    remotePatterns: [{
      protocol: "https",
      hostname: 'lh3.googleusercontent.com',
    },
    {
      protocol: "https",
      hostname: 'avatars.githubusercontent.com',
    }]
  },
  /* config options here */
  reactCompiler: true,
};

export default nextConfig;
