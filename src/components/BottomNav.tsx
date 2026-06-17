"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Network } from "lucide-react";
import clsx from "clsx";

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  const tabs = [
    { href: "/winvote", label: "WinVote", icon: Network },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-aviva-nav border-t border-aviva-gold/20">
      <div className="flex items-center px-1 py-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={clsx(
                "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all active:scale-95",
                active ? "text-aviva-gold" : "text-aviva-secondary/60 hover:text-aviva-secondary"
              )}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-aviva-gold" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
