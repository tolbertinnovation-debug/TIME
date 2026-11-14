import type { MetadataRoute } from "next";

// Lets a student add TIME Learning to their phone's home screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TIME Learning",
    short_name: "TIME Learning",
    description: "Classes, lessons, results, fees and certificates for students of TIME Inc., Liberia.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8f8f3",
    theme_color: "#435e25",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
