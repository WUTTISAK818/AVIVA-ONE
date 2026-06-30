import { NextResponse, NextRequest } from "next/server";
import { callClaudeText } from "@/lib/claude";

interface DesignReviewRequest {
  feature_name: string;
  description: string;
  dept: string;
  owner: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DesignReviewRequest = await request.json();
    const { feature_name, description, dept, owner } = body;

    if (!feature_name || !description || !dept || !owner) {
      return NextResponse.json(
        { error: "Missing required fields: feature_name, description, dept, owner" },
        { status: 400 }
      );
    }

    const system = `คุณเป็น ${owner} ของฝ่าย${dept} ในโครงการ AVIVA ONE`;

    const userPrompt = `งานใหม่ที่กำลังออกแบบ:
- ชื่อ: ${feature_name}
- คำอธิบาย: ${description}

ตรวจให้ทราบ:
1. **Completeness** — requirement ครบหรือไม่จากมุมมองฝ่าย${dept}
2. **Ownership** — ใครรับผิดชอบแต่ละส่วน
3. **Risk/Gap** — ความเสี่ยงหรือช่องว่างของฝ่าย
4. **Recommendation** — ข้อเสนอแนะก่อนเขียนโค้ด

ตอบอย่างสั้น กระชับ`;

    const { text: response, error } = await callClaudeText({
      system,
      messages: [{ role: "user", content: userPrompt }],
      model: "claude-opus-4-8",
      maxTokens: 1024,
    });

    if (error) {
      console.error("Design review API error:", error);
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
      review_type: "design",
      feedback: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Design review error:", error);
    return NextResponse.json(
      { error: "Failed to process design review", details: String(error) },
      { status: 500 }
    );
  }
}
