import { DocData } from "./types";
import { COMPANY, PROJECT, thaiDate } from "@/lib/aviva-doc-data";
import { bahtText, formatNumber } from "@/lib/thai-baht";

function V({ v, w = 80 }: { v: string | number | null | undefined; w?: number }) {
  const s = v == null || v === "" || v === 0 ? "" : String(v);
  return <span className="ul" style={{ minWidth: w }}>{s}</span>;
}

// สัญญาจะซื้อจะขายที่ดินจัดสรรพร้อมสิ่งปลูกสร้าง
export default function ContractDoc({ d }: { d: DocData }) {
  const paidTotal = (d.bookingFee || 0) + (d.contractFee || 0);
  const remaining = d.remaining || (d.price - paidTotal - (d.downTotal || 0));
  return (
    <div className="doc-sheet doc-a4">
      <div style={{ textAlign: "center", fontSize: 16, fontWeight: 700 }}>
        สัญญาจะซื้อจะขายที่ดินจัดสรรพร้อมสิ่งปลูกสร้าง
      </div>
      <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
        โครงการ{PROJECT.name}
      </div>
      <div className="doc-para" style={{ textAlign: "right" }}>สัญญาเลขที่ <V v={d.contractNo} w={80} /></div>
      <div className="doc-para">
        ทำที่ สำนักงานขายโครงการ {PROJECT.name} &nbsp; วันที่ <V v={thaiDate(d.contractDate || d.docDate)} w={150} />
      </div>

      <div className="doc-para">
        สัญญาฉบับนี้ทำขึ้นระหว่าง <b>{COMPANY.name}</b> ที่ตั้งสำนักงาน {COMPANY.regAddress}
        โดย {COMPANY.director} กรรมการผู้มีอำนาจกระทำการแทน โครงการ {PROJECT.name} ตั้งอยู่ {PROJECT.address}
        ซึ่งต่อไปในสัญญานี้เรียกว่า &ldquo;ผู้จะขาย&rdquo; ฝ่ายหนึ่ง
      </div>
      <div className="doc-para">
        กับ <V v={d.customerName} w={200} /> อายุ <V v={d.customerAge} w={40} /> ปี
        บัตรประจำตัวประชาชนเลขที่ <V v={d.customerIdCard} w={150} /> อยู่บ้านเลขที่ <V v={d.customerAddress} w={260} />
        หมายเลขโทรศัพท์ <V v={d.customerPhone} w={120} /> ซึ่งต่อไปในสัญญานี้เรียกว่า &ldquo;ผู้จะซื้อ&rdquo; อีกฝ่ายหนึ่ง
        คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญากันโดยมีข้อความดังต่อไปนี้
      </div>

      <div className="doc-para">
        ผู้จะขายตกลงจะขายและผู้จะซื้อตกลงจะซื้อ ที่ดินพร้อมสิ่งปลูกสร้างในบริเวณโครงการจัดสรรที่ดินตามสัญญานี้
        จำนวน 1 แปลง เป็นที่ดินแปลงที่ <V v={d.plot} w={60} /> แบบบ้าน <V v={d.model} w={60} />
        มีจำนวนเนื้อที่โดยประมาณ <V v={d.landSize} w={50} /> ตารางวา สิ่งปลูกสร้างเป็นอาคารแบบ <V v={d.houseType} w={120} /> จำนวน 1 หลัง
        ซึ่งเป็นส่วนหนึ่งของที่ดินโฉนดเลขที่ <V v={d.titleDeed || PROJECT.titleDeedMaster} w={90} /> ตำบล{PROJECT.tambon} อำเภอ{PROJECT.amphoe} จังหวัด{PROJECT.province}
        ซึ่งเป็นกรรมสิทธิ์ของผู้จะขาย
      </div>

      <div className="doc-clause"><b>ข้อ 1. ราคาจะซื้อจะขาย</b></div>
      <div className="doc-para">
        ผู้จะซื้อและผู้จะขายตกลงจะซื้อขายที่ดินพร้อมสิ่งปลูกสร้างดังกล่าว ในราคารวมทั้งสิ้น <V v={formatNumber(d.price)} w={120} /> บาท
        ( {bahtText(d.price)} )
      </div>

      <div className="doc-clause"><b>ข้อ 2. การชำระเงินและการโอนกรรมสิทธิ์</b></div>
      <div className="doc-para">
        2.1 คู่สัญญาตกลงให้ถือเอาเงินที่ผู้จะซื้อได้ชำระในวันจอง เมื่อวันที่ <V v={thaiDate(d.docDate)} w={130} /> จำนวน {formatNumber(d.bookingFee)} บาท
        ( {bahtText(d.bookingFee)} ) และเงินที่ผู้จะซื้อชำระในวันทำสัญญานี้จำนวน {formatNumber(d.contractFee)} บาท ( {bahtText(d.contractFee)} )
        ในวันที่ <V v={thaiDate(d.contractDate)} w={130} /> รวมเงินที่ชำระแล้วทั้งสิ้น {formatNumber(paidTotal)} บาท ( {bahtText(paidTotal)} )
        ซึ่งถือเป็นเงินประกันการปฏิบัติตามสัญญาและเป็นส่วนหนึ่งของราคาตามข้อ 1
      </div>
      <div className="doc-para">
        2.2 ผู้จะซื้อตกลงชำระค่าที่ดินพร้อมสิ่งปลูกสร้างที่เหลือ จำนวน <V v={formatNumber(remaining)} w={120} /> บาท ( {bahtText(remaining)} )
        ในวันจดทะเบียนโอนกรรมสิทธิ์ ภายในวันที่ <V v={thaiDate(d.transferDate)} w={130} />
      </div>
      <div className="doc-para">
        2.3 ในกรณีที่ผู้จะขายก่อสร้างแล้วเสร็จก่อนวันที่ระบุตามข้อ 2.2 ผู้จะขายจะแจ้งกำหนดนัดโอนกรรมสิทธิ์ล่วงหน้าไม่น้อยกว่า 15 วัน
        หากผู้จะซื้อประสงค์จะกู้เงินจากสถาบันการเงิน ผู้จะขายตกลงอำนวยความสะดวกให้ตามหลักเกณฑ์ของสถาบันการเงิน
        หากผู้จะซื้อมีคุณสมบัติไม่เข้าหลักเกณฑ์ ต้องจัดหาเงินมาชำระภายใน 15 วันนับแต่วันที่ได้รับแจ้ง
      </div>
      <div className="doc-para">
        2.4 หากผู้จะซื้อผิดสัญญาข้อหนึ่งข้อใด ผู้จะขายมีสิทธิบอกเลิกสัญญาและริบเงินที่ชำระทั้งหมดทันที หรือเรียกเบี้ยปรับในอัตราร้อยละ 1.5 ต่อเดือนของจำนวนเงินที่ค้างชำระ
      </div>
      <div className="doc-para">
        2.5 หากผู้จะซื้อผิดนัดไม่ชำระเงินค่างวด 2 งวดติดต่อกัน ผู้จะขายมีสิทธิบอกเลิกสัญญาและริบเงินที่ชำระมาแล้วทั้งหมดได้ทันที
      </div>
      <div className="doc-para">
        2.6 หากผู้จะซื้อประสงค์ขอเปลี่ยนชื่อคู่สัญญา/ผู้รับโอน หรือย้ายแปลง ต้องแจ้งเป็นหนังสือและได้รับความยินยอมเป็นหนังสือจากผู้จะขาย
        และยินยอมชำระค่าดำเนินการ 20,000 บาท (สองหมื่นบาทถ้วน) ต่อครั้ง
      </div>
      <div className="doc-para">
        2.7 ผู้จะซื้อจะไม่เรียกร้องค่าเสียหายในกรณีที่ผู้จะขายไม่สามารถดำเนินโครงการต่อได้เพราะเหตุสุดวิสัย โดยผู้จะขายจะคืนเงินที่ได้รับมาทั้งหมด
      </div>
      <div className="doc-para">
        2.8 การชำระเงินด้วยตราสารใดๆ จะสมบูรณ์ต่อเมื่อผู้จะขายเรียกเก็บเงินตามตราสารนั้นแล้ว
      </div>

      <div className="doc-clause"><b>ข้อ 3. หลักฐานการชำระเงิน</b></div>
      <div className="doc-para">
        ในการชำระเงินค่าที่ดินพร้อมสิ่งปลูกสร้าง ผู้จะขายต้องออกหลักฐานเป็นหนังสือลงลายมือชื่อผู้จะขายหรือผู้รับเงินให้แก่ผู้จะซื้อทุกครั้ง
      </div>

      <div className="doc-para" style={{ marginTop: 6 }}>
        คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยตลอดแล้ว เห็นว่าถูกต้องตรงตามเจตนา จึงได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน
      </div>

      <div className="doc-signatures">
        <div>
          <div className="sig-line" />
          <div>ลงชื่อ...........................................ผู้จะขาย</div>
          <div>( {COMPANY.director} )</div>
        </div>
        <div>
          <div className="sig-line" />
          <div>ลงชื่อ...........................................ผู้จะซื้อ</div>
          <div>( {d.customerName || "..............................."} )</div>
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
