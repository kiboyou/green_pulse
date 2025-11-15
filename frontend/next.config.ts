import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Base URL for the backend API (FastAPI). Override in deployment via env var.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  },
};

export default nextConfig;
