import Link from "next/link";
import { UserCheck, Package, Wrench, Receipt } from "lucide-react";

const ACTIONS = [
  { href: "/community/visitors",         label: "ผู้มาเยือน", icon: UserCheck },
  { href: "/community/parcels",          label: "พัสดุ",       icon: Package },
  { href: "/community/service-requests", label: "แจ้งซ่อม",   icon: Wrench },
  { href: "/community/bills",            label: "บิล",        icon: Receipt },
];

export default function CommunityQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ACTIONS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="bg-aviva-card border border-aviva-gold/15 rounded-2xl p-4 flex flex-col items-center gap-2 active:bg-aviva-card/80 transition-colors min-h-[96px] justify-center"
        >
          <Icon size={28} strokeWidth={1.5} className="text-aviva-gold" />
          <span className="text-sm font-medium text-aviva-text">{label}</span>
        </Link>
      ))}
    </div>
  );
}
