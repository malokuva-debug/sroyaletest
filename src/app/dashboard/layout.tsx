import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Sparta Royale | Menaxhim Sallon",
  description: "Aplikacion menaxhimi për sallonin e thonjve Sparta Royal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sparta Royal",
  },
  icons: {
    apple: "/icon-192.png",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Sparta Royale | Menaxhim Sallon",
    description: "Aplikacion menaxhimi për sallonin e thonjve Sparta Royal",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#471115",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Script id="dashboard-sw-register" strategy="afterInteractive">
        {`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/dashboard/' }).then(function(reg) {
                reg.update().catch(function() {});
              }).catch(function(err) {
                console.log('SW registration failed:', err);
              });
            });
          }
        `}
      </Script>
    </>
  );
}
