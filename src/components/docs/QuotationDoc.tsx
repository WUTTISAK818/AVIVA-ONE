import { DocData } from "./types";
import { COMPANY, PROJECT, PROMOTIONS_STANDARD, QUOTATION_TERMS, thaiDate } from "@/lib/aviva-doc-data";
import { bahtText, formatNumber } from "@/lib/thai-baht";

// ใบเสนอราคา / ใบจองชั่วคราว
export default function QuotationDoc({ d }: { d: DocData }) {
  const salePrice = (d.price || 0) - (d.specialDiscount || 0);
  return (
    <div className="doc-sheet doc-a4">
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>ใบเสนอราคา / ใบจองชั่วคราว</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>โครงการ {PROJECT.nameEn} ({PROJECT.name})</div>
        <div style={{ fontSize: 12 }}>{COMPANY.name}</div>
        <div style={{ fontSize: 12 }}>
          ข้อมูลเพิ่มเติม โทร {PROJECT.phone} &nbsp;|&nbsp; วันที่ {d.docDate ? thaiDate(d.docDate) : "________________"}
        </div>
      </div>

      <table className="doc-table" style={{ marginBottom: 10 }}>
        <thead>
          <tr>
            <th>แปลง</th>
            <th>แบบบ้าน</th>
            <th>เนื้อที่ดิน<br />(ตร.วา)</th>
            <th>พท.ใช้สอย<br />(ตร.ม.)</th>
            <th>ราคา (บาท)</th>
            <th>ส่วนลดพิเศษ</th>
            <th>ราคาขาย (บาท)</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ textAlign: "center" }}>
            <td>{d.plot || "-"}</td>
            <td>{d.model || "-"}</td>
            <td>{d.landSize || "-"}</td>
            <td>{d.usableArea || "-"}</td>
            <td style={{ textAlign: "right" }}>{formatNumber(d.price)}</td>
            <td style={{ textAlign: "right" }}>{d.specialDiscount ? formatNumber(d.specialDiscount) : "-"}</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{formatNumber(salePrice)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>การชำระเงิน / Payments :</div>
      <table className="doc-kv">
        <tbody>
          <tr><td>เงินจอง (Booking Fee)</td><td className="num">{formatNumber(d.bookingFee)}</td><td>บาท</td></tr>
          <tr><td>เงินทำสัญญา (Contract Fee)</td><td className="num">{formatNumber(d.contractFee)}</td><td>บาท</td></tr>
          <tr>
            <td>ผ่อนดาวน์ {d.downInstallments || "____"} งวด ๆ ละ {formatNumber(d.downPerInstallment) || "____"} บาท</td>
            <td className="num">{d.downTotal ? formatNumber(d.downTotal) : "____"}</td><td>บาท</td>
          </tr>
          <tr>
            <td>เงินส่วนที่เหลือ ชำระ ณ วันโอนกรรมสิทธิ์</td>
            <td className="num" style={{ fontWeight: 700 }}>{formatNumber(d.remaining || salePrice - (d.bookingFee + d.contractFee + (d.downTotal || 0)))}</td><td>บาท</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>PROMOTION :</div>
          <ol style={{ margin: "2px 0 0 18px", padding: 0, fontSize: 12, lineHeight: 1.5 }}>
            {PROMOTIONS_STANDARD.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700 }}>เงื่อนไข / Terms and Conditions</div>
        <ol style={{ margin: "2px 0 0 18px", padding: 0, fontSize: 11, lineHeight: 1.4 }}>
          {QUOTATION_TERMS.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      </div>

      <div style={{ marginTop: 10, borderTop: "1px dashed #888", paddingTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>บันทึกการรับเงินเพื่อจองสิทธิ์ (เฉพาะกรณีจองซื้อ)</div>
        <div className="fill-line">ชื่อ-นามสกุลผู้จอง: {d.customerName}</div>
        <div className="fill-line">เบอร์โทรศัพท์: {d.customerPhone}</div>
        <div className="fill-line">ที่อยู่: {d.customerAddress}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          ราคาขายรวมทั้งสิ้น {formatNumber(salePrice)} บาท ({bahtText(salePrice)})
        </div>
      </div>

      <div className="doc-signatures">
        <div>
          <div className="sig-line" />
          <div>ลงชื่อ.......................................ผู้ขาย</div>
          <div>( {COMPANY.receiverName} )</div>
        </div>
        <div>
          <div className="sig-line" />
          <div>ลงชื่อ.......................................ผู้ซื้อ</div>
          <div>( {d.customerName || "....................................."} )</div>
        </div>
      </div>
    </div>
  );
}
