import { DocData } from "./types";
import { COMPANY, PROJECT, GIVEAWAYS_FULL, thaiDate } from "@/lib/aviva-doc-data";
import { bahtText, formatNumber } from "@/lib/thai-baht";

// helper แสดงค่า หรือเส้นใต้ถ้าว่าง
function V({ v, w = 80 }: { v: string | number | null | undefined; w?: number }) {
  const s = v == null || v === "" || v === 0 ? "" : String(v);
  return <span className="ul" style={{ minWidth: w }}>{s}</span>;
}

// หนังสือจองที่ดินพร้อมสิ่งปลูกสร้าง
export default function BookingDoc({ d }: { d: DocData }) {
  const remaining = d.remaining || (d.price - (d.bookingFee + d.contractFee + (d.downTotal || 0)));
  return (
    <div className="doc-sheet doc-a5">
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
        หนังสือจองที่ดินพร้อมสิ่งปลูกสร้าง
      </div>

      <div className="doc-para">
        วันที่ <V v={thaiDate(d.docDate)} w={140} />
      </div>
      <div className="doc-para">
        ข้าพเจ้า <V v={d.customerName} w={200} /> อายุ <V v={d.customerAge} w={40} /> ปี
        บัตรประจำตัวประชาชนเลขที่ <V v={d.customerIdCard} w={150} /> อยู่บ้านเลขที่ <V v={d.customerAddress} w={260} />
        หมายเลขโทรศัพท์ <V v={d.customerPhone} w={120} /> ซึ่งต่อไปนี้จะเรียกว่า &ldquo;ผู้จอง&rdquo;
      </div>
      <div className="doc-para">
        ผู้จองมีความประสงค์เพื่อจองซื้อที่ดินพร้อมสิ่งปลูกสร้างในโครงการ <b>{PROJECT.name}</b> แปลงหมายเลข <V v={d.plot} w={60} />
        ตั้งอยู่ {PROJECT.address} มีจำนวนเนื้อที่โดยประมาณ <V v={d.landSize} w={50} /> ตารางวา
        สิ่งปลูกสร้างเป็นอาคารแบบ <V v={d.houseType} w={140} /> กับ <b>{COMPANY.name}</b> ซึ่งต่อไปจะเรียกว่า &ldquo;บริษัท&rdquo;
        ในราคารวมทั้งสิ้น <V v={formatNumber(d.price)} w={120} /> บาท ( {bahtText(d.price)} ) โดยมีรายละเอียดดังนี้
      </div>

      <div className="doc-para">
        ผู้จองได้ชำระเงินจองแล้วเป็นเงิน <V v={formatNumber(d.bookingFee)} w={90} /> บาท ( {bahtText(d.bookingFee)} ) โดยวันนี้ชำระเป็น
      </div>
      <div className="doc-para" style={{ paddingLeft: 16 }}>
        ({d.paymentMethod === "cash" ? "✓" : "  "}) เงินสด &nbsp;&nbsp;
        ({d.paymentMethod === "transfer" ? "✓" : "  "}) โอนธนาคาร <V v={d.bankName} w={90} /> สาขา <V v={d.bankBranch} w={90} /> &nbsp;&nbsp;
        ({d.paymentMethod === "credit" ? "✓" : "  "}) บัตรเครดิต
      </div>
      <div className="doc-para">
        โดยในวันที่ <V v={thaiDate(d.contractDate)} w={140} /> ผู้จองจะชำระเงินเพื่อทำสัญญาจะซื้อจะขายจำนวน <V v={formatNumber(d.contractFee)} w={90} /> บาท
        ( {bahtText(d.contractFee)} ) และมีรายละเอียดการชำระเงินดาวน์ดังนี้
      </div>
      <div className="doc-para">
        ผ่อนดาวน์ <V v={d.downInstallments} w={40} /> งวด ๆ ละ <V v={formatNumber(d.downPerInstallment)} w={70} /> บาท
        รวมเป็นเงิน <V v={formatNumber(d.downTotal)} w={90} /> บาท
        เงินส่วนที่เหลือชำระ ณ วันโอนกรรมสิทธิ์ <V v={formatNumber(remaining)} w={110} /> บาท ( {bahtText(remaining)} )
      </div>

      <div className="doc-para"><b>รายละเอียดของแถม มีดังนี้</b></div>
      <ol style={{ margin: "0 0 0 18px", padding: 0, fontSize: 12, lineHeight: 1.4, columns: 2 }}>
        {GIVEAWAYS_FULL.map((g, i) => <li key={i} style={{ breakInside: "avoid" }}>{g}</li>)}
      </ol>

      <div className="doc-para" style={{ marginTop: 8, fontSize: 11 }}>
        หากผู้จองผิดนัดชำระเงินค่าสัญญาจะซื้อจะขาย ตามวันเวลาที่ระบุในหนังสือจองฉบับนี้ ให้ถือว่าหนังสือจองฉบับนี้เป็นอันยกเลิกทันที
        โดยมิต้องบอกกล่าว ผู้จองยินยอมให้บริษัทริบเงินที่ชำระมาแล้วทั้งหมดได้ และบริษัทมีสิทธิ์นำที่ดินพร้อมสิ่งปลูกสร้างออกขายแก่ผู้อื่นได้ทันที
        ทั้งสองฝ่ายได้อ่าน ทราบ และเข้าใจข้อความโดยตลอดแล้ว จึงได้ลงลายมือชื่อไว้เป็นหลักฐาน
      </div>

      <div className="doc-signatures">
        <div>
          <div className="sig-line" />
          <div>ลงชื่อ...........................................ผู้จอง</div>
          <div>( {d.customerName || "..............................."} )</div>
        </div>
        <div>
          <div className="sig-line" />
          <div>ลงชื่อ...........................................ผู้รับจอง</div>
          <div>( {COMPANY.receiverName} )</div>
        </div>
      </div>
      <div className="doc-signatures">
        <div>
          <div className="sig-line" />
          <div>ลงชื่อ...........................................พยาน</div>
        </div>
        <div>
          <div className="sig-line" />
          <div>ลงชื่อ...........................................พยาน</div>
        </div>
      </div>
    </div>
  );
}
