// src/app/layout.tsx
import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import "./globals.css"; // Pastikan ini diimpor dan path-nya benar (menunjuk ke src/app/globals.css)

const cinzel = Cinzel({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fantasy Kingdom Map",
  description: "An interactive fantasy kingdom map game built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cinzel.className}>{children}</body>
    </html>
  );
}