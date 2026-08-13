import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sparta Royale | Nail & Beauty Studio",
  description: "Studio premium nail art në Prishtinë. Rezervoni online për manikyr, pedikyr, gel dhe nail art.",
  keywords: ["nail salon", "nail art", "manikyr", "pedikyr", "gel nails", "Prishtinë", "Kosovo", "Sparta Royale"],
  authors: [{ name: "Sparta Royale" }],
  openGraph: {
    title: "Sparta Royale | Nail & Beauty Studio",
    description: "Studio premium nail art në Prishtinë. Rezervoni takimin tuaj online.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sq" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
