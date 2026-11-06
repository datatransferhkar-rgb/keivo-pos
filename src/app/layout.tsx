import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keivo POS — Restoran & QR Ordering",
  description: "Sistem Point of Sale Restoran dengan Dine-in QR, Take Away Walk-in, dan Pesanan Online Delivery",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Keivo POS",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#003629",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents accidental pinch-to-zoom on POS touchscreen tablets
  viewportFit: "cover",
};

import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface font-body-md text-on-surface antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
