// "ตอนนี้ต้องกดอะไร" ของคำสั่งงาน — ข้อความชุดเดียวใช้ทั้งในแอป กระดิ่ง LINE และ cron เตือน
//
// Pom สั่ง 6 ต.ค. 69: "ให้ระบบแจ้งที่ฟ้าหรือผู้ปฏิบัติว่าให้กดอะไรยังไงบ้าง"
// เหตุที่ต้องมี: งานแปลง V29 ฟ้าทำเสร็จจริงตั้งแต่ 3 ต.ค. (บันทึกสัญญา ฿4,280,000 ครบ)
// แต่คำสั่งงานยังค้างขึ้น "เลยกำหนด 7 วัน" เพราะไม่มีใครกด "ทำเสร็จแล้ว · ส่งให้ตรวจรับ"
// ระบบไม่เคยบอกว่าต้องกดอะไรต่อ — คนทำงานเสร็จแล้วก็ยังดูเหมือนไม่ทำงาน

export type DirectiveViewer = "assignee" | "commander";

export interface DirectiveNextStep {
  /** สิ่งที่ต้องทำตอนนี้ — สั้น อ่านจบในบรรทัดเดียว */
  headline: string;
  /** วิธีทำแบบลงมือได้จริง (ชื่อปุ่มตรงกับที่เห็นบนหน้าจอ) */
  detail: string;
  /** todo = ตาคุณ · waiting = รออีกฝ่าย · done = จบแล้ว */
  tone: "todo" | "waiting" | "done";
}

/** ประโยคเดียวที่บอกวิธีปิดงาน — ใช้แนบท้ายแจ้งเตือนทุกช่องทาง */
export const CLOSE_INSTRUCTION =
  'ทำเสร็จแล้วต้องกดปิดงานด้วย ไม่งั้นงานจะค้างในระบบ:\n' +
  '• ในแอป: เมนู "คำสั่งงาน" → แท็บ "ที่ได้รับ" → เขียนรายงานผลงาน → ปุ่ม "ทำเสร็จแล้ว · ส่งให้ตรวจรับ"\n' +
  '• หรือตอบกลับข้อความนี้ใน LINE ว่า: เสร็จแล้ว <สิ่งที่ทำ>';

export function nextStepFor(
  status: string,
  viewer: DirectiveViewer,
  opts: { commanderName?: string | null; assigneeName?: string | null; returned?: boolean } = {},
): DirectiveNextStep {
  const commander = opts.commanderName || "ผู้สั่งงาน";
  const assignee = opts.assigneeName || "พนักงาน";

  if (status === "closed") {
    return { headline: "ปิดจ็อบแล้ว", detail: `${commander} ตรวจรับเรียบร้อย ไม่ต้องทำอะไรเพิ่ม`, tone: "done" };
  }
  if (status === "cancelled") {
    return { headline: "ยกเลิกแล้ว", detail: "คำสั่งงานนี้ถูกยกเลิก ไม่ต้องทำต่อ", tone: "done" };
  }

  if (viewer === "assignee") {
    if (opts.returned) {
      return {
        headline: "👉 ตาคุณ: แก้ตามที่ผู้สั่งตีกลับ แล้วส่งใหม่",
        detail: 'แก้ให้เรียบร้อย → เขียนรายงานผลงานในช่องด้านล่าง → กดปุ่ม "ทำเสร็จแล้ว · ส่งให้ตรวจรับ" อีกครั้ง',
        tone: "todo",
      };
    }
    if (status === "done") {
      return {
        headline: "รอผู้สั่งตรวจรับ",
        detail: `คุณส่งให้ ${commander} แล้ว ไม่ต้องทำอะไรเพิ่ม — รอการตรวจรับและปิดจ็อบ`,
        tone: "waiting",
      };
    }
    // sent / acknowledged / in_progress → ตาพนักงานเสมอ
    return {
      headline: "👉 ตาคุณ: ทำงานให้เสร็จ แล้วกดปิดงาน",
      detail:
        'ทำเสร็จเมื่อไหร่ ต้องกลับมาที่นี่ → เขียนรายงานผลงานในช่องด้านล่าง → กดปุ่ม "ทำเสร็จแล้ว · ส่งให้ตรวจรับ"\n' +
        'ถ้าไม่กด ระบบจะยังนับว่างานค้างอยู่และขึ้นว่าเลยกำหนด แม้คุณจะทำเสร็จไปแล้วก็ตาม\n' +
        'สะดวกกว่านั้น: ตอบใน LINE ว่า "เสร็จแล้ว <สิ่งที่ทำ>" ก็ปิดงานได้เหมือนกัน',
      tone: "todo",
    };
  }

  // ฝั่งผู้สั่งงาน
  if (status === "done") {
    return {
      headline: "👉 ตาคุณ: ตรวจรับและปิดจ็อบ",
      detail: `${assignee} รายงานว่าทำเสร็จแล้ว — อ่านรายงานผลงานแล้วกด "ตรวจรับ · ปิดจ็อบ" หรือ "ตีกลับให้แก้" พร้อมเหตุผล`,
      tone: "todo",
    };
  }
  return {
    headline: `รอ ${assignee} กดปิดงาน`,
    detail:
      `ปุ่ม "ตรวจรับ · ปิดจ็อบ" จะขึ้นให้คุณกดเมื่อ ${assignee} กด "ทำเสร็จแล้ว · ส่งให้ตรวจรับ" แล้วเท่านั้น\n` +
      `ถ้างานเสร็จจริงแล้วแต่ยังไม่ได้กด — บอกให้ ${assignee} ตอบใน LINE ว่า "เสร็จแล้ว <สิ่งที่ทำ>" ก็พอ`,
    tone: "waiting",
  };
}

/** ลำดับการแสดงผลในหน้าคำสั่งงาน
 *  Pom สั่ง 9 ต.ค. 69: "คำสั่งที่ปิดจ็อบแล้วให้เลื่อนไปไว้ล่าง งานที่ค้างอยู่ให้แสดงด้านบนตามลำดับ"
 *  เดิมเรียงตามวันที่สั่งอย่างเดียว -> งานที่เพิ่งปิดจ็อบไปลอยอยู่บนสุด
 *  บังหน้างานที่ยังต้องทำ ยิ่งปิดงานได้มากหน้าจอยิ่งรก
 *
 *  กลุ่ม (น้อยไปมาก = บนลงล่าง):
 *    0  ตาคุณ + เลยกำหนดแล้ว   — ด่วนที่สุด
 *    1  ตาคุณ                   — ต้องลงมือ
 *    2  รออีกฝ่าย + เลยกำหนด    — ต้องไปตาม
 *    3  รออีกฝ่าย               — ยังไม่ต้องทำอะไร
 *    4  ปิดจ็อบ / ยกเลิกแล้ว    — ล่างสุด
 */
export function directiveSortGroup(
  status: string,
  viewer: DirectiveViewer,
  opts: { returned?: boolean; overdue?: boolean } = {},
): number {
  const { tone } = nextStepFor(status, viewer, { returned: opts.returned });
  if (tone === "done") return 4;
  if (tone === "todo") return opts.overdue ? 0 : 1;
  return opts.overdue ? 2 : 3;
}

export interface SortableDirective {
  status: string;
  due_date?: string | null;
  created_at: string;
  returned_at?: string | null;
  closed_at?: string | null;
  cancelled_at?: string | null;
}

/** เรียงคำสั่งงานให้ "งานที่ต้องทำ" อยู่บน และ "งานที่จบแล้ว" ไปล่างสุด
 *  ในกลุ่มเดียวกัน: ใกล้ครบกำหนดก่อน (ไม่มีกำหนดไปท้ายกลุ่ม) แล้วค่อยใหม่สุดก่อน
 *  งานที่จบแล้วเรียงตามเวลาที่จบ ใหม่สุดอยู่บนของกลุ่มล่าง */
export function sortDirectives<T extends SortableDirective>(
  items: T[],
  viewer: DirectiveViewer,
  todayStr: string,
): T[] {
  const FINISHED = ["done", "closed", "cancelled"];
  const keyed = items.map((d) => {
    const overdue = !!d.due_date && d.due_date < todayStr && !FINISHED.includes(d.status);
    return {
      d,
      group: directiveSortGroup(d.status, viewer, { returned: !!d.returned_at && d.status !== "done", overdue }),
      due: d.due_date ?? "9999-12-31",
      finishedAt: d.closed_at ?? d.cancelled_at ?? d.created_at,
    };
  });

  return keyed
    .sort((a, b) => {
      if (a.group !== b.group) return a.group - b.group;
      if (a.group === 4) return b.finishedAt.localeCompare(a.finishedAt);
      if (a.due !== b.due) return a.due.localeCompare(b.due);
      return b.d.created_at.localeCompare(a.d.created_at);
    })
    .map((x) => x.d);
}
