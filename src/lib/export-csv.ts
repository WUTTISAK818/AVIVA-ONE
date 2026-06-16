// ส่งออกข้อมูลเป็นไฟล์ CSV (UTF-8 BOM เปิดใน Excel ภาษาไทยได้)
// ใช้ client-side เท่านั้น (อาศัย document/Blob/URL)
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const esc = (c: string | number | null | undefined) => `"${String(c ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
