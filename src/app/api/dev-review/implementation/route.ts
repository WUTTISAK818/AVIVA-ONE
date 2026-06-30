import { NextResponse, NextRequest } from "next/server";
import { callClaudeText } from "@/lib/claude";

interface ImplementationReviewRequest {
  feature_name: string;
  description: string;
  code_summary: string;
  dept: string;
  owner: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImplementationReviewRequest = await request.json();
    const { feature_name, description, code_summary, dept, owner } = body;

    if (!feature_name || !description || !code_summary || !dept || !owner) {
      return NextResponse.json(
        { error: "Missing required fields: feature_name, description, code_summary, dept, owner" },
        { status: 400 }
      );
    }

    const system = `คุณเป็น ${owner} ของฝ่าย${dept} ในโครงการ AVIVA ONE`;

    const userPrompt = `ฟีเจอร์ที่ตรวจ:
- ชื่อ: ${feature_name}
- คำอธิบาย: ${description}

Code Summary:
${code_summary}

ตรวจให้ทราบ:
1. **Design Compliance** — code ตรงตาม design ไหม
2. **Business Logic** — logic ของฝ่าย${dept} ถูกต้องหรือไม่
3. **Edge Cases** — กรณีพิเศษที่ต้องพิจารณา
4. **Issues Found** — ปัญหาที่พบและต้องปรับ
5. **Approval** — คำวินิจฉัย: สามารถ merge ได้หรือต้องแก้ก่อน

ตอบอย่างสั้น กระชับ`;

    const { text: response, error } = await callClaudeText({
      system,
      messages: [{ role: "user", content: userPrompt }],
      model: "claude-opus-4-8",
      maxTokens: 1024,
    });

    if (error) {
      console.error("Implementation review API error:", error);
      return NextResponse.json(
        { error: "Failed to call Claude API", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feature_name,
      dept,
      owner,
      review_type: "implementation",
      feedback: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Implementation review error:", error);
    return NextResponse.json(
      { error: "Failed to process implementation review", details: String(error) },
      { status: 500 }
    );
  }
}
