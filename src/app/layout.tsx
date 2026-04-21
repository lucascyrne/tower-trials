import type { Metadata, Viewport } from "next";
import "./globals.css";
import ContextSkeleton from "./context-skeleton";
import { EnvironmentIndicator } from "@/components/core/EnvironmentIndicator";

export const metadata: Metadata = {
  title: "Tower Trials",
  description: "Um jogo de aventura e estratégia épico",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tower Trials",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1a1a1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const registerServiceWorker = process.env.NODE_ENV === "production";

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Tower Trials" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1a1a1a" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: registerServiceWorker
              ? `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                    })
                    .catch(function(registrationError) {
                    });
                });
              }
            `
              : "",
          }}
        />
      </head>
      <body className="min-h-screen overflow-x-hidden antialiased">
        <EnvironmentIndicator />
        <ContextSkeleton>{children}</ContextSkeleton>
      </body>
    </html>
  );
}
