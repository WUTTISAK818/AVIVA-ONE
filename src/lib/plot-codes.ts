// ดึง "รหัสแปลง" ออกจากข้อความรายงานหน้างานของวิศวกร
//
// Pom แจ้ง 6 ต.ค. 69: รายงานก่อสร้างประจำวันของวิศวกรไม่มีความสัมพันธ์กับผังในหน้าฝ่ายก่อสร้าง
// ตรวจแล้วพบว่า `houses` (ที่ผังใช้) ไม่ได้ถูกแก้มาตั้งแต่ 18-19 มิ.ย. 69 ขณะที่พีทรายงานหน้างานทุกวัน
// แต่ของดีคือ พีทเขียนรหัสแปลงไว้หน้าข้อความอย่างสม่ำเสมอ จึงจับคู่กับแปลงจริงได้โดยไม่ต้องเดา เช่น
//   "A07-งานเทรางวี100%"                         → A07
//   "V28,29-งานทาสีวงกบ50%,งานทาสีจริงภายใน=45%"  → V28, V29
//   "V13-15 งานฉาบ"                               → V13, V14, V15

/** แปลงรหัสให้เป็นรูปแบบเดียวกับ houses.plot_code เช่น a7 → A07 */
export function normalizePlotCode(letter: string, num: string): string {
  return `${letter.toUpperCase()}${String(parseInt(num, 10)).padStart(2, "0")}`;
}

/**
 * รหัสแปลงทั้งหมดที่ปรากฏใน "ส่วนหัว" ของข้อความ (ก่อนเครื่องหมาย - หรือช่องว่างแรก)
 * อ่านเฉพาะส่วนหัวโดยตั้งใจ — เลขเปอร์เซ็นต์ของเนื้องานด้านหลังจะได้ไม่ถูกเข้าใจผิดว่าเป็นรหัสแปลง
 */
export function plotCodesIn(text: string | null | undefined): string[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];

  // ตัดเอาเฉพาะส่วนหัวก่อนเจอ "-" ที่ตามด้วยตัวอักษรไทย หรือก่อนช่องว่างแรก
  const head = raw.split(/[-\s]ง|[-\s][ก-๙]/)[0].slice(0, 40);

  const out = new Set<string>();
  // รูปแบบ A07 / V28,29 / V13-15 (ช่วง)
  const re = /([AVav])\s*(\d{1,2})((?:\s*[,/]\s*\d{1,2})*)(?:\s*-\s*(\d{1,2}))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(head)) !== null) {
    const letter = m[1];
    const first = parseInt(m[2], 10);
    out.add(normalizePlotCode(letter, m[2]));

    // รายการคั่นด้วย , หรือ / เช่น V28,29
    if (m[3]) {
      for (const n of m[3].split(/[,/]/)) {
        const t = n.trim();
        if (t) out.add(normalizePlotCode(letter, t));
      }
    }
    // ช่วง เช่น V13-15 (จำกัดไม่เกิน 12 แปลง กันข้อความแปลก ๆ ทำให้ได้รายการยาวผิดปกติ)
    if (m[4]) {
      const last = parseInt(m[4], 10);
      if (last > first && last - first <= 12) {
        for (let n = first + 1; n <= last; n++) out.add(normalizePlotCode(letter, String(n)));
      }
    }
  }
  return [...out].sort();
}

/** รวมรหัสแปลงจากหลายบรรทัด (รายการงานทั้งวัน) */
export function plotCodesInAll(texts: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts) for (const c of plotCodesIn(t)) out.add(c);
  return [...out].sort();
}
