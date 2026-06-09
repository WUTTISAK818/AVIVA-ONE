// เรียก Claude (Anthropic Messages API) แบบ raw fetch — เข้ากับ pattern เดิมของโปรเจกต์
// ที่เรียก LLM ผ่าน fetch โดยตรง (ดู src/app/api/ai-chat/route.ts) โดยไม่เพิ่ม dependency
//
// ใช้สำหรับงานสรุป/วางแผนเชิงรุกที่ต้องการผลลัพธ์เป็น JSON มีโครงสร้าง

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const ANTHROPIC_ENABLED = !!process.env.ANTHROPIC_API_KEY;

interface ClaudeJSONParams {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
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
}: ClaudeJSONParams): Promise<{ data: T | null; model: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
    return { data: parsed, model, error: parsed ? undefined : "PARSE_FAILED" };
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
