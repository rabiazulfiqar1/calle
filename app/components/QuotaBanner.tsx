"use client";

interface Props {
  remaining: number;
  limit: number;
  resetAt?: number; // unix ms
}

export default function QuotaBanner({ remaining, limit, resetAt }: Props) {
  const used = limit - remaining;
  const fraction = used / limit;
  const isLow = remaining <= 1;
  const isDepleted = remaining === 0;

  const resetLabel = resetAt
    ? new Date(resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "tomorrow";

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
        isDepleted
          ? "bg-red-50 border-red-200 text-red-800"
          : isLow
          ? "bg-amber-50 border-amber-200 text-amber-800"
          : "bg-zinc-50 border-zinc-200 text-zinc-700"
      }`}
    >
      <PhoneIcon depleted={isDepleted} low={isLow} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">
            {isDepleted
              ? "Daily call limit reached"
              : `${remaining} of ${limit} calls remaining today`}
          </span>
          {isDepleted && (
            <span className="text-xs shrink-0 opacity-70">
              Resets at {resetLabel}
            </span>
          )}
        </div>
        {/* Usage bar */}
        <div className="mt-2 h-1 rounded-full bg-black/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isDepleted ? "bg-red-400" : isLow ? "bg-amber-400" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(fraction * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function PhoneIcon({ depleted, low }: { depleted: boolean; low: boolean }) {
  const color = depleted ? "#b91c1c" : low ? "#92400e" : "#3f3f46";
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="mt-0.5 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.428a.5.5 0 0 1 .485.379l.714 2.857a.5.5 0 0 1-.143.497L4.57 6.646a9.526 9.526 0 0 0 4.783 4.783l.913-1.413a.5.5 0 0 1 .497-.143l2.857.714a.5.5 0 0 1 .38.485V12.5A1.5 1.5 0 0 1 12.5 14C6.701 14 2 9.299 2 3.5Z"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
