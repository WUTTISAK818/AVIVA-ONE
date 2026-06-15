"use client";

import { useCurrentUser } from "@/lib/user-context";

export default function CommunityHero() {
  const user = useCurrentUser();
  const firstName = user?.full_name?.split(" ")?.[0]?.replace(/^(คุณ|นาย|นางสาว|นาง|ดร\.|ดร)\s*/, "") ?? "";
  const greeting = firstName ? `สวัสดี คุณ${firstName}` : "สวัสดี";

  return (
    <section
      className="relative mx-4 mt-4 rounded-3xl overflow-hidden aspect-[4/3] max-w-lg md:mx-auto border border-aviva-gold/15"
      aria-label="Hero — AVIVA Private community"
      style={{
        backgroundImage: [
          "linear-gradient(180deg, rgba(10,31,26,0) 35%, rgba(10,31,26,0.92) 100%)",
          "radial-gradient(ellipse at 75% 85%, rgba(202,168,106,0.28), transparent 55%)",
          "linear-gradient(135deg, #0a1f1a 0%, #13302a 55%, #2a3320 100%)",
        ].join(", "),
      }}
    >
      <svg
        viewBox="0 0 400 300"
        className="absolute inset-0 w-full h-full opacity-25"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden
      >
        <g fill="#06140f">
          <path d="M0,300 L0,220 Q40,205 80,212 L140,200 Q190,205 220,210 L290,200 Q340,205 400,215 L400,300 Z" />
          <path d="M55,300 L60,205 Q40,180 35,165 Q55,160 70,170 Q72,150 85,148 Q92,160 92,178 Q108,160 122,165 Q122,182 108,195 L82,210 L78,300 Z" />
          <path d="M335,300 L340,215 Q320,195 318,180 Q335,178 350,188 Q352,165 366,162 Q372,178 372,195 Q388,180 398,188 Q398,205 384,215 L362,225 L358,300 Z" />
        </g>
        <g fill="#caa86a" opacity="0.35">
          <rect x="170" y="175" width="60" height="2" />
          <rect x="160" y="180" width="80" height="30" />
          <polygon points="160,180 200,160 240,180" />
          <rect x="178" y="190" width="10" height="14" />
          <rect x="200" y="190" width="10" height="14" />
          <rect x="222" y="190" width="6" height="14" />
        </g>
      </svg>

      <div className="absolute bottom-0 left-0 right-0 p-5">
        <p className="text-aviva-text font-bold text-2xl tracking-wide">{greeting}</p>
        <p className="text-aviva-gold/90 text-sm mt-1">เริ่มต้นวันที่ดีของคุณ ใน AVIVA Private</p>
      </div>
    </section>
  );
}
