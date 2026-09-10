import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AuthProvider from "@/components/AuthProvider";
import KillServiceWorker from "@/components/KillServiceWorker";
import AccessibilityControls from "@/components/AccessibilityControls";
import { UserProvider } from "@/lib/user-context";
import { ThemeProvider } from "@/lib/theme-context";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-sans-thai",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "WinVote",
  description: "WinVote — ระบบเครือข่ายฐานเสียง",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "WinVote" },
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
  other: { "mobile-web-app-capable": "yes" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${ibmPlexSansThai.variable} h-full antialiased`}>
      <body className="min-h-full bg-aviva-bg text-aviva-text pb-20">
        <KillServiceWorker />
        <ThemeProvider>
          <UserProvider>
            <AuthProvider>{children}</AuthProvider>
            <BottomNav />
            <AccessibilityControls />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
