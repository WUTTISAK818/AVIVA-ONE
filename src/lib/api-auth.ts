import "server-only";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { createHmac } from "crypto";
import { isManagerRole } from "@/lib/roles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

/**
 * Verify API request authentication using Supabase auth token
 * Optionally checks user role against required roles
 *
 * @param req - Next.js request object
 * @param requiredRoles - Optional array of role names. If provided, user role must match one of them
 * @returns Promise resolving to { user, error } where error is string if auth failed, undefined if passed
 *
 * @example
 * const { user, error } = await verifyAuth(req);
 * if (error) return NextResponse.json({ error }, { status: 401 });
 *
 * @example
 * const { user, error } = await verifyAuth(req, ["admin", "manager"]);
 * if (error) return NextResponse.json({ error }, { status: 403 });
 */
export async function verifyAuth(
  req: NextRequest,
  requiredRoles?: string[]
): Promise<{ user: any; error?: string }> {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return { user: null, error: "Missing authorization token" };
    }

    // Create Supabase client with anon key
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    // Verify token and get user
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return { user: null, error: "Invalid or expired token" };
    }

    // If requiredRoles provided, check user role
    if (requiredRoles && requiredRoles.length > 0) {
      // Try to get user role from database
      const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: dbUser, error: dbErr } = await db
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (dbErr || !dbUser) {
        return { user: null, error: "Failed to fetch user role" };
      }

      // Check if user role is in requiredRoles using isManagerRole logic
      const userRole = dbUser.role as string | undefined;
      const hasRequiredRole = requiredRoles.some((role) =>
        userRole?.toLowerCase().trim() === role.toLowerCase().trim()
      );

      // Also check if user has manager-level role (covers CEO/COO/admin/etc)
      const hasManagerAccess = requiredRoles.includes("manager") && isManagerRole(userRole);

      if (!hasRequiredRole && !hasManagerAccess) {
        return { user: null, error: "Insufficient permissions" };
      }

      // Return user with role attached for context
      return { user: { ...user, role: userRole } };
    }

    return { user };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    return { user: null, error: message };
  }
}

/**
 * Verify LINE webhook signature using HMAC-SHA256
 * Compares incoming signature with calculated signature using timing-safe comparison
 *
 * @param body - Raw request body string
 * @param signature - X-Line-Signature header value (base64 encoded)
 * @param channelSecret - LINE channel secret
 * @returns boolean - true if signature is valid, false otherwise
 *
 * @example
 * const body = await req.text();
 * const signature = req.headers.get("X-Line-Signature") ?? "";
 * if (!verifyLineSignature(body, signature, process.env.LINE_CHANNEL_SECRET!)) {
 *   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
 * }
 */
export function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  try {
    // Calculate HMAC-SHA256 hash
    const hash = createHmac("sha256", channelSecret).update(body).digest();
    const expectedSignature = hash.toString("base64");

    // Convert both to Buffer for timing-safe comparison
    const incomingBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    // Check lengths first (timing-safe against length-based attacks)
    if (incomingBuffer.length !== expectedBuffer.length) {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    try {
      timingSafeEqual(incomingBuffer, expectedBuffer);
      return true;
    } catch {
      // timingSafeEqual throws if buffers don't match
      return false;
    }
  } catch (err) {
    // Any error during verification → invalid signature
    return false;
  }
}
