import type { MetadataRoute } from "next";

// PWA manifest (TASK-009). Served at /manifest.webmanifest; Next auto-adds the
// <link rel="manifest"> tag. Colours come from the surface token (docs/design.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas",
    short_name: "Atlas",
    description: "Ein ruhiges, redaktionelles Lebens-OS — ein Gedanke, ein Eintrag.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6ECE8",
    theme_color: "#F6ECE8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
