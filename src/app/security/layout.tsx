import RoleGate from "@/components/security/RoleGate";

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate personas={["admin", "manager"]}>
      {children}
    </RoleGate>
  );
}
