import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that belong to AVIVA ONE (sales/dev-ops persona).
const ONE_PREFIXES = [
  "/accounting",
  "/admin",
  "/after-sales",
  "/ai",
  "/approvals",
  "/construction",
  "/crm",
  "/dashboard",
  "/documents",
  "/finance",
  "/hr",
  "/marketing",
  "/office",
  "/api/ai-chat",
  "/api/mock-alpr",
];

// Routes that belong to AVIVA Plus (resident / guard / juristic persona).
const PLUS_PREFIXES = [
  "/community",
  "/guard",
  "/security",
  "/v",
  "/api/announcements",
  "/api/bills",
  "/api/gate-events",
  "/api/gates",
  "/api/juristic-journals",
  "/api/residents",
  "/api/resolutions",
  "/api/visitor-passes",
];

// /login, /settings, /api/promptpay-qr — visible on both deployments.

function hasPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function proxy(request: NextRequest) {
  const target = process.env.NEXT_PUBLIC_TARGET;

  if (target !== "one" && target !== "plus") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const blockedPrefixes = target === "one" ? PLUS_PREFIXES : ONE_PREFIXES;

  if (hasPrefix(pathname, blockedPrefixes)) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|robots\\.txt|sitemap\\.xml|icons/).*)",
  ],
};
