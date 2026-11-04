import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify localhost-ийг зөвшөөрдөггүй тул локалд 127.0.0.1-ээр нээдэг. Энэгүйгээр dev дээр хуудас hydrate болохгүй.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/", destination: "/home", permanent: false }];
  },
};

export default nextConfig;
