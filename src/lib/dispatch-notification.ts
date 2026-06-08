import "server-only";
import { sendPush } from "./push-notify";
import { sendLine } from "./line";
import { sendSms } from "./sms";

export interface DispatchInput {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  push?: { department?: string; userEmail?: string };
  lineUserId?: string;
  smsPhone?: string;
}

export interface DispatchResult {
  push: number;
  line: boolean;
  sms: boolean;
  notes: string[];
}

/** Fan-out to every channel. Each channel is best-effort and isolated. */
export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const notes: string[] = [];
  const text = `${input.title}\n${input.body}` + (input.url ? `\n${input.url}` : "");

  const [pushR, lineR, smsR] = await Promise.allSettled([
    input.push ? sendPush(input.push, { title: input.title, body: input.body, url: input.url, tag: input.tag }) : Promise.resolve({ sent: 0, skipped: "no-target" }),
    input.lineUserId ? sendLine(input.lineUserId, text) : Promise.resolve({ ok: false, skipped: "no-line-user" }),
    input.smsPhone ? sendSms(input.smsPhone, text) : Promise.resolve({ ok: false, skipped: "no-phone" }),
  ]);

  const push = pushR.status === "fulfilled" ? pushR.value.sent : 0;
  if (pushR.status === "fulfilled" && pushR.value.skipped) notes.push(`push:${pushR.value.skipped}`);
  const line = lineR.status === "fulfilled" ? lineR.value.ok : false;
  if (lineR.status === "fulfilled" && lineR.value.skipped) notes.push(`line:${lineR.value.skipped}`);
  const sms = smsR.status === "fulfilled" ? smsR.value.ok : false;
  if (smsR.status === "fulfilled" && smsR.value.skipped) notes.push(`sms:${smsR.value.skipped}`);

  return { push, line, sms, notes };
}
