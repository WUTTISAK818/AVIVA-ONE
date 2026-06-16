import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import HelpAssistant from "@/components/HelpAssistant";
import AuthProvider from "@/components/AuthProvider";
import SWRegister from "@/components/SWRegister";
import { UserProvider } from "@/lib/user-context";
import { ThemeProvider } from "@/lib/theme-context";
import CelebrationBroadcaster from "@/components/CelebrationBroadcaster";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-sans-thai",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const TARGET = process.env.NEXT_PUBLIC_TARGET;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const BRAND = TARGET === "plus"
  ? { title: "AVIVA Plus", description: "ระบบบริการลูกบ้าน AVIVA Private", themeColor: "#0A1F1A" }
  : { title: "AVIVA ONE",  description: "ระบบบริหารจัดการ AVIVA ONE",     themeColor: "#D4AF37" };

export const metadata: Metadata = {
  title: BRAND.title,
  description: BRAND.description,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: BRAND.title },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: BRAND.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${ibmPlexSansThai.variable} h-full antialiased`}>
      <body className="min-h-full bg-aviva-bg text-aviva-text pb-20">
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}</Script>
          </>
        )}
        <ThemeProvider>
          <UserProvider>
            <AuthProvider>{children}</AuthProvider>
            <BottomNav />
            <HelpAssistant />
            <SWRegister />
            <CelebrationBroadcaster />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
