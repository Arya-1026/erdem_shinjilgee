import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify localhost-ийг зөвшөөрдөггүй тул локалд 127.0.0.1-ээр нээдэг. Энэгүйгээр dev дээр хуудас hydrate болохгүй.
  // 192.168.*.*: утсаараа ижил Wi-Fi-аас (жишээ нь http://192.168.1.58:3000) нээж шалгахад
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*"],
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
    return [
      { source: "/", destination: "/home", permanent: false },
      // Чат одоо хөвөгч цонх болсон
      { source: "/chat", destination: "/home", permanent: false },
      // Тайлан хуудас Хуваарь дотор «Миний тойм» болж нэгдсэн
      { source: "/stats", destination: "/todo", permanent: false },
      // Найзуудын чат хасагдсан: найзаа профайлын «Найзууд» цонхноос удирдана, сэтгэл санаа нь Нүүр хуудсанд
      { source: "/friends", destination: "/profile", permanent: false },
    ];
  },
};

export default nextConfig;
