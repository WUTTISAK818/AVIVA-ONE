import clsx from "clsx";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  gold?: boolean;
  onClick?: () => void;
  dataFocus?: string;   // สำหรับ deep-link จากกล่องงาน (useFocusHighlight)
}

export default function GlassCard({ children, className, gold, onClick, dataFocus }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      data-focus={dataFocus}
      className={clsx(
        // เลี่ยง backdrop-blur (GPU หนักมากบนมือถือเก่า — ทำหน้าเด้งเมื่อมีการ์ดหลายใบ)
        // ใช้พื้นทึบขึ้นแทนเพื่อคงลุคการ์ด
        "rounded-2xl border",
        gold
          ? "bg-aviva-gold/10 border-aviva-gold/30"
          : "bg-aviva-card/95 border-aviva-gold/10",
        className
      )}
    >
      {children}
    </div>
  );
}
