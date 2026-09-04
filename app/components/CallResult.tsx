"use client";

interface CallResultProps {
  result: any;
  templateId?: string;
  quotaRemaining?: number;
}

export default function CallResult({ result, templateId, quotaRemaining }: CallResultProps) {
  if (!result) return null;

  const status: string = result.status ?? "unknown";
  const taskCompleted: boolean = Boolean(result.taskCompleted);
  const evidence: string[] = Array.isArray(result.evidence) ? result.evidence : [];
  const structuredResult = result.structuredResult ?? result.recipientResult ?? null;

  const statusLabel =
    status === "completed"
      ? "Call completed"
      : status === "failed"
      ? "Call failed"
      : status === "no_answer"
      ? "No answer"
      : status;

  const statusStyles =
    status === "completed" && taskCompleted
      ? "bg-green-50 border-green-200"
      : status === "completed" && !taskCompleted
      ? "bg-amber-50 border-amber-200"
      : "bg-red-50 border-red-200";

  const iconColor =
    status === "completed" && taskCompleted
      ? "#16a34a"
      : status === "completed" && !taskCompleted
      ? "#b45309"
      : "#dc2626";

  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden">
      {/* Header bar */}
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-inherit ${statusStyles}`}>
        <StatusIcon completed={taskCompleted && status === "completed"} color={iconColor} />
        <div>
          <p className="font-semibold text-zinc-900">{statusLabel}</p>
          <p className="text-sm text-zinc-500">
            {taskCompleted ? "The task was completed successfully." : "The task could not be completed."}
          </p>
        </div>
      </div>

      {/* Evidence */}
      {evidence.length > 0 && (
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            What happened
          </h3>
          <ul className="flex flex-col gap-2">
            {evidence.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Structured result */}
      {structuredResult && (
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            Details from the call
          </h3>
          <StructuredResultView data={structuredResult} templateId={templateId} />
        </div>
      )}

      {/* Quota */}
      {typeof quotaRemaining === "number" && (
        <div className="px-5 py-3 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs text-zinc-400">Daily quota</span>
          <span className="text-xs font-medium text-zinc-600">
            {quotaRemaining} call{quotaRemaining !== 1 ? "s" : ""} remaining today
          </span>
        </div>
      )}
    </div>
  );
}

function StructuredResultView({ data, templateId }: { data: any; templateId?: string }) {
  if (!data || typeof data !== "object") return null;

  // Human-friendly key labels
  const KEY_LABELS: Record<string, string> = {
    confirmed: "Confirmed",
    scheduledTime: "Scheduled time",
    notes: "Notes",
    outcome: "Outcome",
    answer: "Answer",
    evidence: "Evidence",
    message_delivered: "Message delivered",
    cancelled: "Cancelled",
    needs_more_info: "Needs more info",
    on_the_way_with_eta: "On the way — ETA provided",
    delayed_no_eta: "Delayed — no ETA",
    order_not_found: "Order not found",
  };

  const entries = Object.entries(data).filter(
    ([k, v]) => v !== null && v !== undefined && v !== "" && k !== "evidence"
  );

  if (entries.length === 0) return null;

  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-xs text-zinc-400 pt-0.5 capitalize">
            {KEY_LABELS[key] ?? key.replace(/_/g, " ")}
          </dt>
          <dd className="text-sm text-zinc-800 font-medium">
            {typeof value === "boolean"
              ? value ? "Yes" : "No"
              : KEY_LABELS[String(value)] ?? String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatusIcon({ completed, color }: { completed: boolean; color: string }) {
  if (completed) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="1.5" />
        <path d="M6.5 10 9 12.5 13.5 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="1.5" />
      <path d="M10 6v5M10 14v.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
