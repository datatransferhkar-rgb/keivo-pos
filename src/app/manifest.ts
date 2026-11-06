import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pawon Nusantara POS — Kasir Restoran",
    short_name: "Keivo POS",
    description: "Sistem Point of Sale Restoran & Kasir Layar Sentuh Tablet",
    start_url: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#ffffff",
    theme_color: "#003629",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

