import RoleGate from "@/components/security/RoleGate";
import { avivaPlusFont } from "@/lib/aviva-plus-font";

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={avivaPlusFont.className}>
      <RoleGate personas={["admin", "manager"]}>
        {children}
      </RoleGate>
    </div>
  );
}
