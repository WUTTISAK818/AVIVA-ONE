import GuardShell from "@/components/security/GuardShell";
import RoleGate from "@/components/security/RoleGate";
import { avivaPlusFont } from "@/lib/aviva-plus-font";

export default function GuardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={avivaPlusFont.className}>
      <RoleGate personas={["guard", "admin", "manager"]}>
        <GuardShell>{children}</GuardShell>
      </RoleGate>
    </div>
  );
}
