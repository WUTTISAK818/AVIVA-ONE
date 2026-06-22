"use client";

import { useState, useRef } from "react";
import { useCurrentUser } from "@/lib/user-context";
import GlassCard from "@/components/GlassCard";
import SectionHeader from "@/components/SectionHeader";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader,
  Download,
  Trash2,
  Eye,
  Clock,
} from "lucide-react";

interface ReceiptData {
  date: string;
  vendor_name: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
  subtotal: number;
  vat: number;
  total: number;
  payment_method: string;
  vendor_tax_id?: string;
}

interface GLSuggestion {
  category: string;
  gl_account: string;
  account_name: string;
  confidence: number;
  flags: Array<{
    severity: "low" | "medium" | "high";
    message: string;
  }>;
}

interface ProcessedReceipt {
  documentId: string;
  fileName: string;
  status: "uploaded" | "processing" | "ready_for_approval" | "review_needed" | "saved" | "error" | "pending_approval";
  extracted_data?: ReceiptData;
  gl_suggestion?: GLSuggestion;
  confidence?: number;
  extraction_model?: string;
  uploaded_at: string;
  error?: string;
}

export default function ReceiptProcessorPage() {
  const user = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<ProcessedReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ProcessedReceipt | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!user?.isAdmin && user?.role?.toLowerCase() !== "accounting" && user?.role?.toLowerCase() !== "finance") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-aviva-bg">
        <GlassCard className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-aviva-text mb-2">Access Denied</h1>
          <p className="text-aviva-secondary">Only accounting/finance staff can access this page.</p>
        </GlassCard>
      </div>
    );
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);

    try {
      // Validate file
      if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
        throw new Error("Invalid file type. Only JPG, PNG, and PDF allowed.");
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File too large (max 10MB)");
      }

      // Get token from localStorage
      const token = localStorage.getItem("sb-token") || localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Authentication required");
      }

      // Upload file
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", "receipt");

      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const uploadData = await uploadRes.json();
      const documentId = uploadData.documentId;

      // Create receipt record
      const newReceipt: ProcessedReceipt = {
        documentId,
        fileName: file.name,
        status: "uploaded",
        uploaded_at: new Date().toISOString(),
      };

      setReceipts((prev) => [newReceipt, ...prev]);

      // Auto-process
      setProcessing(true);
      const processRes = await fetch("/api/documents/process", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentId }),
      });

      if (!processRes.ok) {
        const errorData = await processRes.json();
        setReceipts((prev) =>
          prev.map((r) =>
            r.documentId === documentId
              ? { ...r, status: "error" as const, error: errorData.error }
              : r
          )
        );
        setProcessing(false);
        setUploading(false);
        return;
      }

      const processData = await processRes.json();

      // Update receipt with processed data
      setReceipts((prev) =>
        prev.map((r) =>
          r.documentId === documentId
            ? {
                ...r,
                status: processData.status || "ready_for_approval",
                extracted_data: processData.data?.extracted_data,
                gl_suggestion: processData.data?.gl_suggestion,
                confidence: processData.data?.confidence,
                extraction_model: processData.data?.extraction_model,
              }
            : r
        )
      );

      if (processData.status === "ready_for_approval" || processData.status === "review_needed") {
        setSelectedReceipt(
          receipts.find((r) => r.documentId === documentId) || {
            documentId,
            fileName: file.name,
            status: processData.status,
            extracted_data: processData.data?.extracted_data,
            gl_suggestion: processData.data?.gl_suggestion,
            confidence: processData.data?.confidence,
            extraction_model: processData.data?.extraction_model,
            uploaded_at: new Date().toISOString(),
          }
        );
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveReceipt = async (receipt: ProcessedReceipt) => {
    if (!receipt.extracted_data || !receipt.gl_suggestion) {
      setUploadError("Receipt data incomplete");
      return;
    }

    const token = localStorage.getItem("sb-token") || localStorage.getItem("access_token");
    if (!token) {
      setUploadError("Authentication required");
      return;
    }

    try {
      setProcessing(true);

      const recordData = {
        documentId: receipt.documentId,
        vendor_name: receipt.extracted_data.vendor_name,
        expense_date: receipt.extracted_data.date,
        description: receipt.extracted_data.items
          .map((i) => `${i.description} (${i.quantity} x ${i.unit_price})`)
          .join(", "),
        amount: receipt.extracted_data.subtotal,
        vat: receipt.extracted_data.vat,
        total: receipt.extracted_data.total,
        gl_account: receipt.gl_suggestion.gl_account,
        payment_method: receipt.extracted_data.payment_method || "bank",
        notes: `OCR Confidence: ${receipt.confidence}%, Model: ${receipt.extraction_model}`,
      };

      const recordRes = await fetch("/api/accounting/record-expense", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recordData),
      });

      if (!recordRes.ok) {
        const errorData = await recordRes.json();
        throw new Error(errorData.error || "Record failed");
      }

      const recordData2 = await recordRes.json();

      // Update receipt status
      setReceipts((prev) =>
        prev.map((r) =>
          r.documentId === receipt.documentId
            ? {
                ...r,
                status: recordData2.approval_required ? ("pending_approval" as const) : ("saved" as const),
              }
            : r
        )
      );

      setSelectedReceipt(null);
      setUploadError(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProcessing(false);
    }
  };

  const getFlagColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-red-500 bg-red-50 border-red-200";
      case "medium":
        return "text-amber-600 bg-amber-50 border-amber-200";
      case "low":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { color: string; icon: React.ReactNode; label: string } } = {
      uploaded: { color: "bg-gray-100 text-gray-700", icon: <Upload className="w-4 h-4" />, label: "Uploaded" },
      processing: {
        color: "bg-blue-100 text-blue-700",
        icon: <Loader className="w-4 h-4 animate-spin" />,
        label: "Processing",
      },
      ready_for_approval: { color: "bg-yellow-100 text-yellow-700", icon: <Eye className="w-4 h-4" />, label: "Ready" },
      review_needed: {
        color: "bg-orange-100 text-orange-700",
        icon: <AlertCircle className="w-4 h-4" />,
        label: "Review Needed",
      },
      saved: { color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-4 h-4" />, label: "Saved" },
      pending_approval: {
        color: "bg-purple-100 text-purple-700",
        icon: <Clock className="w-4 h-4" />,
        label: "Pending Approval",
      },
      error: { color: "bg-red-100 text-red-700", icon: <AlertCircle className="w-4 h-4" />, label: "Error" },
    };

    const config = statusConfig[status] || statusConfig.uploaded;
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-aviva-bg p-4 md:p-8">
      <SectionHeader
        title="📋 Receipt OCR Processor"
        subtitle="Upload receipts → AI reads → Auto-save to GL"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <h2 className="text-lg font-bold text-aviva-text mb-4">Upload Receipt</h2>

            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                dragActive
                  ? "border-aviva-primary bg-aviva-primary/10"
                  : "border-aviva-secondary/30 bg-aviva-bg hover:border-aviva-primary/50"
              }`}
            >
              <Upload className="w-12 h-12 mx-auto mb-3 text-aviva-secondary/60" />
              <h3 className="font-semibold text-aviva-text mb-1">Drag & drop receipt here</h3>
              <p className="text-sm text-aviva-secondary mb-4">or click to select from computer</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || processing}
                className="px-4 py-2 bg-aviva-primary text-white rounded-lg hover:bg-aviva-primary/90 disabled:opacity-50"
              >
                {uploading || processing ? "Processing..." : "Select File"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
                disabled={uploading || processing}
                className="hidden"
              />
            </div>

            {/* Supported formats */}
            <p className="text-xs text-aviva-secondary/60 mt-4">
              📁 JPG, PNG, PDF (max 10MB) | Supported: Thai/English receipts
            </p>

            {/* Error message */}
            {uploadError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">❌ {uploadError}</p>
              </div>
            )}
          </GlassCard>

          {/* Selected Receipt Preview */}
          {selectedReceipt && (
            <GlassCard className="p-6 mt-6">
              <h2 className="text-lg font-bold text-aviva-text mb-4">Receipt Preview</h2>

              {selectedReceipt.status === "review_needed" && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <p className="text-sm text-amber-700">
                    ⚠️ OCR confidence ({selectedReceipt.confidence}%) is below 85%. Please review and correct if needed.
                  </p>
                </div>
              )}

              {selectedReceipt.extracted_data && (
                <div className="space-y-4">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-aviva-secondary">Vendor</p>
                      <p className="font-semibold text-aviva-text">{selectedReceipt.extracted_data.vendor_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-aviva-secondary">Date</p>
                      <p className="font-semibold text-aviva-text">{selectedReceipt.extracted_data.date}</p>
                    </div>
                  </div>

                  {/* Items */}
                  {selectedReceipt.extracted_data.items && selectedReceipt.extracted_data.items.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-aviva-secondary mb-2">Items</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-aviva-secondary/20">
                            <th className="text-left text-aviva-secondary px-2 py-1">Description</th>
                            <th className="text-right text-aviva-secondary px-2 py-1">Qty</th>
                            <th className="text-right text-aviva-secondary px-2 py-1">Unit Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReceipt.extracted_data.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-aviva-secondary/10">
                              <td className="text-aviva-text px-2 py-1">{item.description}</td>
                              <td className="text-right text-aviva-text px-2 py-1">{item.quantity}</td>
                              <td className="text-right text-aviva-text px-2 py-1">
                                {item.unit_price.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Amounts */}
                  <div className="bg-aviva-bg p-3 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-aviva-secondary">Subtotal</span>
                      <span className="font-semibold text-aviva-text">
                        {selectedReceipt.extracted_data.subtotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-aviva-secondary">VAT (7%)</span>
                      <span className="font-semibold text-aviva-text">
                        {selectedReceipt.extracted_data.vat.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-base border-t border-aviva-secondary/20 pt-2">
                      <span className="font-bold text-aviva-text">Total</span>
                      <span className="font-bold text-aviva-primary">
                        {selectedReceipt.extracted_data.total.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* GL Suggestion */}
                  {selectedReceipt.gl_suggestion && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-600 font-semibold mb-1">GL Account Suggestion</p>
                      <p className="text-sm font-semibold text-blue-900">
                        {selectedReceipt.gl_suggestion.gl_account} - {selectedReceipt.gl_suggestion.account_name}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Category: {selectedReceipt.gl_suggestion.category} (Confidence: {selectedReceipt.gl_suggestion.confidence}%)
                      </p>
                    </div>
                  )}

                  {/* Flags */}
                  {selectedReceipt.gl_suggestion && selectedReceipt.gl_suggestion.flags.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-aviva-secondary mb-2">⚠️ Flags</p>
                      <div className="space-y-2">
                        {selectedReceipt.gl_suggestion.flags.map((flag, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded border ${getFlagColor(flag.severity)}`}
                          >
                            <p className="text-xs">{flag.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-aviva-secondary/20">
                    <button
                      onClick={() => handleSaveReceipt(selectedReceipt)}
                      disabled={processing}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
                    >
                      {processing ? "Saving..." : "✅ Confirm & Save"}
                    </button>
                    <button
                      onClick={() => setSelectedReceipt(null)}
                      disabled={processing}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
                    >
                      ❌ Cancel
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>
          )}
        </div>

        {/* Recent Receipts */}
        <div className="lg:col-span-1">
          <GlassCard className="p-6">
            <h2 className="text-lg font-bold text-aviva-text mb-4">Recent Uploads</h2>

            {receipts.length === 0 ? (
              <p className="text-sm text-aviva-secondary text-center py-8">No receipts uploaded yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {receipts.map((receipt) => (
                  <div
                    key={receipt.documentId}
                    onClick={() => setSelectedReceipt(receipt)}
                    className="p-3 bg-aviva-bg rounded-lg border border-aviva-secondary/20 hover:border-aviva-primary/50 cursor-pointer transition-all"
                  >
                    <p className="text-xs font-semibold text-aviva-text truncate mb-2">
                      {receipt.extracted_data?.vendor_name || receipt.fileName}
                    </p>
                    <div className="flex items-center justify-between mb-2">
                      {getStatusBadge(receipt.status)}
                      {receipt.confidence && (
                        <span className="text-xs text-aviva-secondary">
                          {receipt.confidence}% OCR
                        </span>
                      )}
                    </div>
                    {receipt.extracted_data?.total && (
                      <p className="text-sm font-bold text-aviva-primary">
                        ฿ {receipt.extracted_data.total.toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-aviva-secondary mt-1">
                      {new Date(receipt.uploaded_at).toLocaleString("th-TH")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
