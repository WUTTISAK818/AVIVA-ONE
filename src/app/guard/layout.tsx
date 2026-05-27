import GuardShell from "@/components/security/GuardShell";
import RoleGate from "@/components/security/RoleGate";

export default function GuardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate personas={["guard", "admin", "manager"]}>
      <GuardShell>{children}</GuardShell>
    </RoleGate>
  );
}
