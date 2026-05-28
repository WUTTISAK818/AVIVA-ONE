import { avivaPlusFont } from "@/lib/aviva-plus-font";

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <div className={avivaPlusFont.className}>{children}</div>;
}
