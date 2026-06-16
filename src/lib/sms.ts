import "server-only";

const KEY = process.env.THAIBULKSMS_API_KEY;
const SECRET = process.env.THAIBULKSMS_API_SECRET;
const SENDER = process.env.THAIBULKSMS_SENDER ?? "AVIVA";

export function smsConfigured(): boolean {
  return !!(KEY && SECRET);
}

/** Best-effort SMS via ThaiBulkSMS v2. Never throws. */
export async function sendSms(toPhone: string, text: string): Promise<{ ok: boolean; skipped?: string }> {
  if (!KEY || !SECRET) return { ok: false, skipped: "no-sms-credentials" };
  if (!toPhone) return { ok: false, skipped: "no-recipient" };
  const msisdn = toPhone.replace(/[^0-9]/g, "");
  try {
    const body = new URLSearchParams({ msisdn, message: text, sender: SENDER });
    const auth = Buffer.from(`${KEY}:${SECRET}`).toString("base64");
    const res = await fetch("https://api-v2.thaibulksms.com/sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: body.toString(),
    });
    return { ok: res.ok, skipped: res.ok ? undefined : `sms-http-${res.status}` };
  } catch {
    return { ok: false, skipped: "sms-error" };
  }
}
