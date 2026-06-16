import type { MetadataRoute } from "next";

const TARGET = process.env.NEXT_PUBLIC_TARGET;

const PLUS_BRAND = {
  name: "AVIVA Plus · AVIVA Private",
  short_name: "AVIVA Plus",
  description: "ระบบบริการลูกบ้าน AVIVA Private",
  start_url: "/community/announcements",
} as const;

const ONE_BRAND = {
  name: "AVIVA ONE",
  short_name: "AVIVA ONE",
  description: "AI-Powered Real Estate Executive Operating System",
  start_url: "/dashboard",
} as const;

export default function manifest(): MetadataRoute.Manifest {
  const isPlus = TARGET === "plus";
  const brand = isPlus ? PLUS_BRAND : ONE_BRAND;
  return {
    ...brand,
    display: "standalone",
    background_color: "#0A1A14",
    theme_color: isPlus ? "#0A1F1A" : "#D4AF37",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: TARGET === "plus" ? ["lifestyle", "social"] : ["business", "productivity"],
    lang: "th",
  };
}
