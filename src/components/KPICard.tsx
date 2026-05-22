import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";

interface KPICardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  highlight?: boolean;
  onClick?: () => void;
}

export default function KPICard({
  icon: Icon,
  label,
  value,
  change,
  changeLabel,
  highlight,
  onClick,
}: KPICardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      onClick={onClick}
      className={clsx(
        "rounded-2xl p-4 flex flex-col gap-2 border transition-all",
        highlight ? "bg-aviva-gold/10 border-aviva-gold/40" : "bg-aviva-card border-aviva-gold/10",
        onClick && "cursor-pointer active:scale-[0.97] hover:border-aviva-gold/30"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-xl bg-aviva-gold/10">
          <Icon size={16} className="text-aviva-gold" />
        </div>
        {change !== undefined && (
          <div
            className={clsx(
              "flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full",
              isPositive
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            )}
          >
            {isPositive ? (
              <TrendingUp size={10} />
            ) : (
              <TrendingDown size={10} />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-aviva-text">{value}</p>
        <p className="text-xs text-aviva-secondary mt-0.5">{label}</p>
        {changeLabel && (
          <p className="text-[10px] text-aviva-secondary/60 mt-0.5">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}
