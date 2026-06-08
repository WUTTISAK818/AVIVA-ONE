import "server-only";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@aviva.local";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface PushTarget {
  department?: string;
  userEmail?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Best-effort web push. Never throws — returns count sent. */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<{ sent: number; skipped?: string }> {
  if (!ensureConfigured()) return { sent: 0, skipped: "no-vapid" };
  const db = admin();
  let q = db.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (target.userEmail) q = q.eq("user_email", target.userEmail);
  else if (target.department) q = q.eq("department", target.department);
  const { data: subs } = await q;
  if (!subs || subs.length === 0) return { sent: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const dead: string[] = [];
  await Promise.allSettled(
    subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
      }
    })
  );
  if (dead.length) await db.from("push_subscriptions").delete().in("endpoint", dead);
  return { sent };
}
