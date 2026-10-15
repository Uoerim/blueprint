import type { MetadataRoute } from "next";

// Makes Blueprint installable as a home-screen app on Android, iOS and desktop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blueprint",
    short_name: "Blueprint",
    description: "A private idea vault and execution board for small teams.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090B",
    theme_color: "#09090B",
    categories: ["productivity", "business"],
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
