import "server-only";
import { getSetting } from "./app-config";

const LINE_API = "https://api.line.me/v2/bot/message/push";

// โทเคนมาจาก env (แนะนำ) หรือ app_settings.line_channel_access_token (ตั้งผ่าน DB ได้)
function lineToken(): Promise<string | undefined> {
  return getSetting("line_channel_access_token", process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

export async function lineConfigured(): Promise<boolean> {
  return !!(await lineToken());
}

/** Best-effort LINE push. Never throws. */
export async function sendLine(toUserId: string, text: string): Promise<{ ok: boolean; skipped?: string }> {
  const token = await lineToken();
  if (!token) return { ok: false, skipped: "no-line-token" };
  if (!toUserId) return { ok: false, skipped: "no-recipient" };
  try {
    const res = await fetch(LINE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: toUserId, messages: [{ type: "text", text }] }),
    });
    return { ok: res.ok, skipped: res.ok ? undefined : `line-http-${res.status}` };
  } catch {
    return { ok: false, skipped: "line-error" };
  }
}

export async function replyLine(replyToken: string, text: string): Promise<void> {
  const token = await lineToken();
  if (!token) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
  } catch { /* best-effort */ }
}
