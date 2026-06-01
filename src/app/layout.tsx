import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AuthProvider from "@/components/AuthProvider";
import { UserProvider } from "@/lib/user-context";
import { ThemeProvider } from "@/lib/theme-context";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

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
  themeColor: BRAND.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${geist.variable} h-full antialiased`}>
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
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
