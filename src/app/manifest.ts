import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AVIVA ONE",
    short_name: "AVIVA ONE",
    description: "AI-Powered Real Estate Executive Operating System",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0A1A14",
    theme_color: "#D4AF37",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["business", "productivity"],
    lang: "th",
  };
}
