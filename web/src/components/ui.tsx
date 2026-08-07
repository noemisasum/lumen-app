import type { ReactNode } from "react";

type NoticeTone = "error" | "success" | "info" | "warning";

const noticeStyles: Record<NoticeTone, string> = {
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  info: "border-zinc-200 bg-zinc-50 text-zinc-800",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
};

export function Notice({
  tone,
  title,
  children,
}: {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-lg border px-3 py-3 text-sm ${noticeStyles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      <div className="font-medium">{title}</div>
      {children ? <div className="mt-1 leading-5 opacity-85">{children}</div> : null}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex min-h-5 items-center gap-2 text-sm text-current">
      <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-100 ${className}`} aria-hidden="true" />;
}
