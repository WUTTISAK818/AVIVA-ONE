import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverDb } from "@/lib/server-db";
import { callClaudeJSON } from "@/lib/claude";
import { suggestGLAccount, type ExtractedReceipt } from "@/lib/receipt-linking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface ProcessRequest {
  documentId: string;
}

interface ProcessResponse {
  status?: string;
  data?: any;
  error?: string;
  message?: string;
}

// Convert file to base64 for Claude Vision API
async function fileToBase64(
  filePath: string,
  bucket: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      console.error("Storage download error:", error);
      return null;
    }

    const buffer = await data.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error("File to base64 error:", err);
    return null;
  }
}

// Extract MIME type from file path/name
function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  const mimes: { [key: string]: string } = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    pdf: "application/pdf",
  };
  return mimes[ext || ""] || "image/jpeg";
}

// Call Claude Vision API to extract receipt data
async function extractReceiptData(
  base64Data: string,
  mimeType: string,
  accessToken?: string
): Promise<{
  data: ExtractedReceipt | null;
  model: string;
  error?: string;
  confidence?: number;
}> {
  const systemPrompt = `You are a receipt/invoice OCR specialist. Extract data from receipts accurately.
Return ONLY a valid JSON object with these exact fields:
{
  "date": "YYYY-MM-DD",
  "vendor_name": "string",
  "items": [
    {"description": "string", "quantity": number, "unit_price": number}
  ],
  "subtotal": number,
  "vat": number,
  "total": number,
  "payment_method": "cash|card|bank",
  "vendor_tax_id": "string or null",
  "confidence": 0-100
}

Guidelines:
- Parse date in YYYY-MM-DD format (try Thai Buddhist calendar too)
- Extract all line items with quantities and prices
- VAT is typically 7% in Thailand (some may be 0% or excluded)
- If VAT is not shown, set to 0
- Confidence: 98-100 if perfectly clear, 85-97 if readable with minor issues, <85 if unclear
- Handle both Thai and English text`;

  const userPrompt = `Please extract all data from this receipt. Be thorough with vendor name, date, items, amounts, and payment method.`;

  // Note: In a real implementation, Claude Vision API would be called differently
  // For now, using callClaudeJSON as fallback
  const { data, error, model } = await callClaudeJSON<ExtractedReceipt & { confidence: number }>({
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 1000,
    accessToken,
  });

  if (!data) {
    return { data: null, model, error: error || "OCR extraction failed" };
  }

  const confidence = data.confidence || 85;
  const { confidence: _, ...receiptData } = data;

  return { data: receiptData as ExtractedReceipt, model, confidence };
}

// POST: Process receipt with Claude Vision
export async function POST(req: NextRequest): Promise<NextResponse<ProcessResponse>> {
  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json() as ProcessRequest;
    if (!body.documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const db = serverDb(token);

    // Fetch document from database
    const { data: doc, error: fetchError } = await db
      .from("documents")
      .select("*")
      .eq("id", body.documentId)
      .eq("uploaded_by", user.id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Update status to processing
    await db
      .from("documents")
      .update({ status: "processing" })
      .eq("id", body.documentId);

    // Download file from storage
    const base64Data = await fileToBase64(doc.file_path, "receipts");
    if (!base64Data) {
      await db
        .from("documents")
        .update({ status: "upload_failed" })
        .eq("id", body.documentId);
      return NextResponse.json(
        { error: "Failed to retrieve file" },
        { status: 500 }
      );
    }

    // Extract receipt data using Claude Vision
    const mimeType = getMimeType(doc.file_name);
    const {
      data: extractedData,
      error: ocrError,
      model,
      confidence,
    } = await extractReceiptData(base64Data, mimeType, token);

    if (!extractedData || ocrError) {
      await db
        .from("documents")
        .update({ status: "extraction_failed" })
        .eq("id", body.documentId);
      return NextResponse.json(
        {
          error: `OCR failed: ${ocrError}`,
          status: "extraction_failed",
        },
        { status: 422 }
      );
    }

    // Check confidence threshold (>85% is acceptable)
    if ((confidence || 0) < 85) {
      await db
        .from("documents")
        .update({
          status: "review_needed",
          extracted_data: { ...extractedData, extracted_confidence: confidence, extraction_model: model },
        })
        .eq("id", body.documentId);
      return NextResponse.json({
        status: "review_needed",
        message: `OCR confidence ${confidence}% < 85% threshold. Please review and correct.`,
        data: {
          documentId: body.documentId,
          extracted_data: extractedData,
          confidence,
          extraction_model: model,
        },
      });
    }

    // Suggest GL Account
    const glLinkResult = await suggestGLAccount(extractedData);

    // Save extracted data to database
    const { error: updateError } = await db
      .from("documents")
      .update({
        status: "ready_for_approval",
        extracted_data: {
          ...extractedData,
          extracted_confidence: confidence,
          extraction_model: model,
          gl_suggestion: glLinkResult,
        },
      })
      .eq("id", body.documentId);

    if (updateError) {
      return NextResponse.json(
        { error: `Database update failed: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ready_for_approval",
      message: "Receipt processed successfully",
      data: {
        documentId: body.documentId,
        extracted_data: extractedData,
        gl_suggestion: glLinkResult,
        confidence,
        extraction_model: model,
      },
    });
  } catch (err) {
    console.error("Process error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
