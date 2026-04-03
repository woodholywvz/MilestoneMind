import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@coral-xyz/anchor", "@solana/web3.js"],
};

export default nextConfig;
