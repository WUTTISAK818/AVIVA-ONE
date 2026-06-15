import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AVIVA Plus · AVIVA Private",
    short_name: "AVIVA Plus",
    description: "ระบบบริการลูกบ้าน AVIVA Private",
    start_url: "/community/announcements",
    display: "standalone",
    background_color: "#0A1A14",
    theme_color: "#0A1F1A",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["lifestyle", "social"],
    lang: "th",
  };
}
