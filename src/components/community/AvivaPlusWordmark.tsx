import { avivaPlusWordmarkFont } from "@/lib/aviva-plus-font";
import clsx from "clsx";

export default function AvivaPlusWordmark({
  className = "",
  tone = "gold",
}: {
  className?: string;
  tone?: "gold" | "white";
}) {
  return (
    <span
      className={clsx(
        avivaPlusWordmarkFont.className,
        "tracking-[0.04em] font-medium leading-none",
        tone === "gold" ? "text-aviva-gold" : "text-aviva-text",
        className,
      )}
    >
      AVIVA Plus
    </span>
  );
}
