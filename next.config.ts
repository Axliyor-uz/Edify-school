import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async headers() {
    return [
      {
        // Android update gate polls this on every launch — must never be served
        // stale by a browser/CDN, or released updates go unnoticed.
        source: "/app/version.json",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
