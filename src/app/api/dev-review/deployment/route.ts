import { NextResponse, NextRequest } from "next/server";
import { callClaudeText } from "@/lib/claude";

interface DeploymentReviewRequest {
  feature_name: string;
  description: string;
  deployment_summary: string;
  dept: string;
  owner: string;
  data_check?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DeploymentReviewRequest = await request.json();
    const { feature_name, description, deployment_summary, dept, owner, data_check } = body;

    if (!feature_name || !description || !deployment_summary || !dept || !owner) {
      return NextResponse.json(
        { error: "Missing required fields: feature_name, description, deployment_summary, dept, owner" },
        { status: 400 }
      );
    }

    const system = `คุณเป็น ${owner} ของฝ่าย${dept} ในโครงการ AVIVA ONE`;

    const userPrompt = `ฟีเจอร์ที่ deploy:
- ชื่อ: ${feature_name}
- คำอธิบาย: ${description}

Deployment Summary:
${deployment_summary}

${data_check ? `\nData/Live Check:\n${data_check}` : ""}

ตรวจให้ทราบ:
1. **Production Readiness** — สามารถใช้จริงในสภาพ production ได้หรือไม่
2. **Data Integrity** — ข้อมูล flow/integration ถูกต้อง
3. **Impact Assessment** — ผลกระทบต่อฝ่าย${dept} และผู้ใช้
4. **Action Items** — ใครต้องทราบ/ทำอะไรต่อ
5. **Approval** — ✔️ Ready to go หรือ ⚠️ ต้องแก้ก่อน

ตอบอย่างสั้น กระชับ`;

    const { text: response, error } = await callClaudeText({
      system,
      messages: [{ role: "user", content: userPrompt }],
      model: "claude-opus-4-8",
      maxTokens: 1024,
    });

    if (error) {
      console.error("Deployment review API error:", error);
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
      review_type: "deployment",
      feedback: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Deployment review error:", error);
    return NextResponse.json(
      { error: "Failed to process deployment review", details: String(error) },
      { status: 500 }
    );
  }
}
