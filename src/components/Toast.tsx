"use client";
import { useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = "success", onClose, duration = 2500 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const cfg: Record<ToastType, { Icon: typeof CheckCircle; color: string; bg: string }> = {
    success: { Icon: CheckCircle,    color: "text-green-400",  bg: "bg-green-500/15 border-green-500/30" },
    error:   { Icon: XCircle,        color: "text-red-400",    bg: "bg-red-500/15 border-red-500/30" },
    warning: { Icon: AlertTriangle,  color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
    info:    { Icon: Info,           color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/30" },
  };
  const { Icon, color, bg } = cfg[type];

  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2.5 px-4 py-3 rounded-2xl border ${bg} shadow-xl max-w-xs w-max`}>
      <Icon size={16} className={color} />
      <p className={`text-sm font-medium ${color} whitespace-nowrap`}>{message}</p>
    </div>
  );
}
