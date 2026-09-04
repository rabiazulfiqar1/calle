"use client";

type Status = "idle" | "planning" | "calling" | "success" | "error";

interface Props {
  status: Status;
  label?: string;
}

const STATUS_CONFIG: Record<
  Status,
  { dot: string; text: string; bg: string; defaultLabel: string }
> = {
  idle: {
    dot: "bg-zinc-300",
    text: "text-zinc-500",
    bg: "bg-zinc-50 border-zinc-200",
    defaultLabel: "Ready",
  },
  planning: {
    dot: "bg-amber-400 animate-pulse",
    text: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    defaultLabel: "CALL-E is planning…",
  },
  calling: {
    dot: "bg-blue-500 animate-pulse",
    text: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    defaultLabel: "CALL-E is calling…",
  },
  success: {
    dot: "bg-green-500",
    text: "text-green-700",
    bg: "bg-green-50 border-green-200",
    defaultLabel: "Call complete",
  },
  error: {
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50 border-red-200",
    defaultLabel: "Something went wrong",
  },
};

export default function StatusBadge({ status, label }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {label ?? cfg.defaultLabel}
    </span>
  );
}
