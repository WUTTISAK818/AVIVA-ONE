import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AuthProvider from "@/components/AuthProvider";
import { UserProvider } from "@/lib/user-context";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AVIVA ONE V2.0",
  description: "ระบบบริหารจัดการ AVIVA ONE V2.0",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "AVIVA ONE V2.0" },
  other: { "mobile-web-app-capable": "yes" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-aviva-bg text-aviva-text pb-20">
        <UserProvider>
          <AuthProvider>{children}</AuthProvider>
          <BottomNav />
        </UserProvider>
      </body>
    </html>
  );
}
