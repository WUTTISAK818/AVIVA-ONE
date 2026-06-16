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
        "rounded-2xl border backdrop-blur-sm",
        gold
          ? "bg-aviva-gold/5 border-aviva-gold/30"
          : "bg-aviva-card/80 border-aviva-gold/10",
        className
      )}
    >
      {children}
    </div>
  );
}
