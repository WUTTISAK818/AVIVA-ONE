import "server-only";

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_API = "https://api.line.me/v2/bot/message/push";

export function lineConfigured(): boolean {
  return !!LINE_TOKEN;
}

/** Best-effort LINE push. Never throws. */
export async function sendLine(toUserId: string, text: string): Promise<{ ok: boolean; skipped?: string }> {
  if (!LINE_TOKEN) return { ok: false, skipped: "no-line-token" };
  if (!toUserId) return { ok: false, skipped: "no-recipient" };
  try {
    const res = await fetch(LINE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify({ to: toUserId, messages: [{ type: "text", text }] }),
    });
    return { ok: res.ok, skipped: res.ok ? undefined : `line-http-${res.status}` };
  } catch {
    return { ok: false, skipped: "line-error" };
  }
}

export async function replyLine(replyToken: string, text: string): Promise<void> {
  if (!LINE_TOKEN) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
  } catch { /* best-effort */ }
}
