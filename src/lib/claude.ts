// เรียก Claude (Anthropic Messages API) แบบ raw fetch — เข้ากับ pattern เดิมของโปรเจกต์
// ที่เรียก LLM ผ่าน fetch โดยตรง (ดู src/app/api/ai-chat/route.ts) โดยไม่เพิ่ม dependency
//
// ใช้สำหรับงานสรุป/วางแผนเชิงรุกที่ต้องการผลลัพธ์เป็น JSON มีโครงสร้าง

import { getSetting } from "@/lib/app-config";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// key มาจาก env (แนะนำ) หรือ app_settings.ANTHROPIC_API_KEY (ตั้งผ่านหน้า settings ในแอปได้)
// accessToken: ใช้สิทธิ์ผู้ใช้ที่ล็อกอินอ่าน app_settings เมื่อไม่มี service role key ใน env
async function getApiKey(accessToken?: string): Promise<string | undefined> {
  return getSetting("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY, accessToken);
}

export async function anthropicEnabled(accessToken?: string): Promise<boolean> {
  return !!(await getApiKey(accessToken));
}

interface ClaudeJSONParams {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  accessToken?: string;
}

/**
 * เรียก Claude แล้วบังคับให้ตอบเป็น JSON object เดียว (parse ให้พร้อมใช้)
 * คืน null เมื่อ: ไม่มี API key / API error / parse ไม่สำเร็จ — ให้ผู้เรียกจัดการ fallback เอง
 */
export async function callClaudeJSON<T = unknown>({
  system,
  user,
  model = "claude-opus-4-8",
  maxTokens = 2000,
  timeoutMs = 30_000,
  accessToken,
}: ClaudeJSONParams): Promise<{ data: T | null; model: string; error?: string }> {
  const apiKey = await getApiKey(accessToken);
  if (!apiKey) return { data: null, model, error: "NO_API_KEY" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system:
          system +
          "\n\nสำคัญ: ตอบกลับเป็น JSON object ที่ถูกต้องเพียงหนึ่งชุดเท่านั้น ห้ามมีข้อความอื่นนำหน้าหรือต่อท้าย ห้ามใส่ ```",
        messages: [{ role: "user", content: user }],
      }),
    });
    clearTimeout(timeout);
    const json = await res.json();
    if (!res.ok) {
      return { data: null, model, error: json?.error?.message || `HTTP ${res.status}` };
    }
    const text: string =
      (json.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("") ?? "";
    const parsed = extractJson<T>(text);
    // แยก "โดนตัดเพราะชน max_tokens" ออกจาก "JSON ผิดรูป" เพื่อ debug ง่ายขึ้น
    const failReason = json?.stop_reason === "max_tokens" ? "TRUNCATED" : "PARSE_FAILED";
    return { data: parsed, model, error: parsed ? undefined : failReason };
  } catch (err) {
    clearTimeout(timeout);
    return { data: null, model, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

// ดึง JSON object ก้อนแรกออกจากข้อความ (เผื่อโมเดลใส่ข้อความเกินมา)
function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

interface ClaudeChatParams {
  system: string;
  messages: { role: string; content: string }[];
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  accessToken?: string;
}

/**
 * เรียก Claude แบบสนทนา (คืนข้อความธรรมดา ไม่บังคับ JSON) — สำหรับ AVIVA AI โหมดถาม-ตอบ
 * รองรับประวัติสนทนา (messages) และ persona ผ่าน system
 * คืน text ว่างพร้อม error เมื่อ: ไม่มี key / API error — ให้ผู้เรียกจัดการ fallback เอง
 */
export async function callClaudeText({
  system,
  messages,
  model = "claude-haiku-4-5",
  maxTokens = 900,
  timeoutMs = 30_000,
  accessToken,
}: ClaudeChatParams): Promise<{ text: string; model: string; error?: string }> {
  const apiKey = await getApiKey(accessToken);
  if (!apiKey) return { text: "", model, error: "NO_API_KEY" };

  // เก็บเฉพาะ role ที่ถูกต้องและมีเนื้อหา และต้องเริ่มด้วย user เสมอ
  const filtered = messages
    .filter(m => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content.trim() }));
  while (filtered.length && filtered[0].role !== "user") filtered.shift();
  // Claude บังคับ user/assistant สลับกัน — รวมข้อความ role เดียวกันที่ติดกันเข้าด้วยกัน
  const cleaned: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of filtered) {
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else cleaned.push({ ...m });
  }
  if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== "user") {
    return { text: "", model, error: "NO_MESSAGE" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: cleaned }),
    });
    clearTimeout(timeout);
    const json = await res.json();
    if (!res.ok) {
      return { text: "", model, error: json?.error?.message || `HTTP ${res.status}` };
    }
    const text: string = (json.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();
    return { text, model, error: text ? undefined : "EMPTY" };
  } catch (err) {
    clearTimeout(timeout);
    return { text: "", model, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
