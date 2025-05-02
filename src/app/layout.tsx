import type { Metadata } from "next";
import "./globals.css";
import ContextSkeleton from "./context-skeleton";

export const metadata: Metadata = {
  title: "Tower Trials",
  description: "Um jogo de aventura e estratégia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className="min-h-screen overflow-x-hidden antialiased">
        <ContextSkeleton>{children}</ContextSkeleton>
      </body>
    </html>
  );
}
