// ฐานกลางสำหรับ "โหมด A — สร้างเอกสารจากแอป" (พิมพ์ผ่าน browser -> Save as PDF)
// ทุก template ใช้ shell เดียวกัน: หัวบริษัท/โครงการ + เลขเอกสาร + ส่วนเซ็น
import { COMPANY, PROJECT } from "./aviva-doc-data";
import type { DocPrefix } from "./doc-numbers";

/** นิยาม template เอกสารที่แต่ละหน้าจอส่งให้ DocumentBox/AttachDocButton (เฟส 2) */
export interface DocTemplate {
  key: string;       // id ภายใน
  label: string;     // ป้ายปุ่ม/รายการ เช่น "ใบสั่งซื้อวัสดุ"
  docType: string;   // machine type เก็บใน entity_documents.doc_type เช่น "po"
  prefix?: DocPrefix; // ถ้ามี -> ขอเลขรันอัตโนมัติ (FIN/PO/...)
  fixedNumber?: string; // ถ้ามี -> ใช้เลขนี้เลย (เช่น PO ที่มีเลขอยู่แล้ว) ข้ามการรันใหม่
  render: (docNumber: string) => string; // คืน HTML (ใช้ renderDocShell ภายใน)
}

/** escape HTML กันค่าที่มี < > & " ทำ layout พัง */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface DocShellOpts {
  title: string;          // ชื่อเอกสาร เช่น "ใบสั่งซื้อวัสดุ"
  docNumber?: string;     // เลขรันเอกสาร เช่น "PO-26003"
  dateText?: string;      // วันที่ (ไทย) — ไม่ใส่ = วันนี้
  bodyHtml: string;       // เนื้อหา (HTML)
  signLabels?: string[];  // ป้ายช่องเซ็น เช่น ["ผู้จัดทำ","ผู้อนุมัติ"]
}

function thaiDate(d = new Date()): string {
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

/** ประกอบเอกสารเต็มหน้า A4 พร้อมหัว/ท้าย — คืน HTML string สำหรับพิมพ์ */
export function renderDocShell(o: DocShellOpts): string {
  const date = o.dateText ?? thaiDate();
  const signs = (o.signLabels ?? ["ผู้จัดทำ", "ผู้อนุมัติ"])
    .map(
      (l) => `<div class="sign"><div class="sign-line"></div><div>(........................................)</div><div>${l}</div></div>`
    )
    .join("");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>${o.title}${o.docNumber ? " " + o.docNumber : ""}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Sarabun","TH Sarabun New","Tahoma",sans-serif; color:#111; font-size:14px; line-height:1.55; margin:0; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #b8860b; padding-bottom:10px; }
  .co { font-weight:700; font-size:16px; }
  .co-sub, .proj { font-size:12px; color:#444; }
  .docmeta { text-align:right; font-size:12px; }
  .docno { font-family:monospace; font-weight:700; font-size:15px; color:#b8860b; }
  h1 { text-align:center; font-size:18px; margin:18px 0 14px; }
  table { width:100%; border-collapse:collapse; margin:8px 0; }
  th,td { border:1px solid #ccc; padding:6px 8px; font-size:13px; }
  th { background:#f5efe0; text-align:left; }
  .totals { margin-top:8px; width:50%; margin-left:auto; }
  .totals td { border:none; padding:3px 8px; }
  .signs { display:flex; justify-content:space-around; margin-top:48px; }
  .sign { text-align:center; font-size:13px; }
  .sign-line { width:200px; border-top:1px dotted #555; margin:0 auto 6px; }
  .muted { color:#666; font-size:12px; }
</style></head>
<body>
  <div class="head">
    <div>
      <div class="co">${COMPANY.name}</div>
      <div class="co-sub">${COMPANY.nameEn}</div>
      <div class="proj">โครงการ ${PROJECT.name} · โทร ${PROJECT.phone}</div>
    </div>
    <div class="docmeta">
      ${o.docNumber ? `<div class="docno">${o.docNumber}</div>` : ""}
      <div>วันที่ ${date}</div>
    </div>
  </div>
  <h1>${o.title}</h1>
  ${o.bodyHtml}
  <div class="signs">${signs}</div>
  <div class="muted" style="text-align:center; margin-top:24px;">เอกสารนี้ออกจากระบบ AVIVA ONE</div>
</body></html>`;
}

/** พิมพ์ HTML ผ่าน hidden iframe (เลี่ยง popup-block) — ผู้ใช้เลือก Save as PDF ได้ */
export function printDocument(html: string) {
  if (typeof document === "undefined") return;
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow;
  const fire = () => {
    win?.focus();
    win?.print();
    setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 1500);
  };
  if (doc.readyState === "complete") setTimeout(fire, 300);
  else iframe.onload = () => setTimeout(fire, 300);
}

/** helper สร้างตารางรายการแบบมาตรฐาน (ลำดับ/รายการ/จำนวน/ราคา) */
export function renderItemsTable(
  cols: string[],
  rows: (string | number)[][]
): string {
  const head = cols.map((c) => `<th>${esc(c)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${typeof c === "number" ? c.toLocaleString() : esc(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
