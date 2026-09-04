"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/app/components/Nav";
import StatusBadge from "@/app/components/StatusBadge";
import CallResult from "@/app/components/CallResult";

// ── Template Definitions ──────────────────────────────────────────────────

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "checkbox" | "list" | "select";
  placeholder?: string;
  optional?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
};

type TemplateDef = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  fields: FieldDef[];
};

const TEMPLATES: TemplateDef[] = [
  {
    id: "appointment",
    label: "Book an Appointment",
    description: "CALL-E calls and books a time slot on your behalf.",
    icon: <CalendarIcon />,
    fields: [
      { key: "bookingType", label: "What type of appointment?", type: "text", placeholder: "e.g. dentist checkup, haircut, GP visit" },
      { key: "purpose", label: "Why are you booking this?", type: "textarea", placeholder: "e.g. Routine cleaning, first consultation about tooth pain" },
      { key: "preferredTimeRange", label: "When would you like it?", type: "text", placeholder: "e.g. Any weekday afternoon this week" },
    ],
  },
  {
    id: "cancellation",
    label: "Cancel a Service",
    description: "CALL-E calls and requests cancellation — firmly and politely.",
    icon: <XCircleIcon />,
    fields: [
      { key: "serviceName", label: "What are you cancelling?", type: "text", placeholder: "e.g. Netflix, gym membership, meal kit subscription" },
      { key: "accountReference", label: "Account or reference number", type: "text", placeholder: "Optional", optional: true },
      { key: "reasonForCancelling", label: "Reason (if asked)", type: "textarea", placeholder: "Optional — CALL-E will only share this if the agent asks", optional: true },
    ],
  },
  {
    id: "order_status",
    label: "Check Order Status",
    description: "CALL-E calls the seller and finds out where your order is.",
    icon: <PackageIcon />,
    fields: [
      { key: "orderedFrom", label: "Who did you order from?", type: "text", placeholder: "e.g. Amazon seller, local restaurant, Daraz store" },
      { key: "whatWasOrdered", label: "What did you order?", type: "text", placeholder: "e.g. Blue running shoes, size 10" },
      { key: "orderReference", label: "Order reference or number", type: "text", placeholder: "e.g. ORD-4821" },
    ],
  },
  {
    id: "relay_message",
    label: "Relay a Message",
    description: "CALL-E delivers your message to someone you care about.",
    icon: <MessageIcon />,
    fields: [
      { key: "contactName", label: "Who are we calling?", type: "text", placeholder: "e.g. Ahmed, Dr. Siddiqui, Mom" },
      { key: "relationship", label: "Your relationship to them", type: "text", placeholder: "e.g. friend, colleague, mother — optional", optional: true },
      { key: "messageToRelay", label: "What should CALL-E say?", type: "textarea", placeholder: "e.g. I'm running 20 minutes late to our meeting. I'm on my way." },
      { key: "location", label: "Your location (optional)", type: "text", placeholder: "Share where you are if relevant", optional: true, hint: "Only shared if location consent is enabled below." },
      { key: "locationConsent", label: "Share my location in the message", type: "checkbox" },
    ],
  },
  {
    id: "elder_checkup",
    label: "Elder Check-in",
    description: "CALL-E has a warm, caring conversation with someone you love.",
    icon: <HeartIcon />,
    fields: [
      { key: "personName", label: "Who should CALL-E speak with?", type: "text", placeholder: "e.g. Nana, Uncle Tariq, Mrs. Khan" },
      { key: "thingsToAsk", label: "Topics to cover", type: "list", placeholder: "One topic per line — e.g.\nHow are you feeling today?\nHave you eaten?\nDid you take your medicine?", hint: "CALL-E will raise these naturally, not read them like a script." },
      { key: "reminder", label: "A gentle reminder to pass along", type: "text", placeholder: "e.g. Don't forget your doctor's appointment on Thursday — optional", optional: true },
    ],
  },
];

const REGIONS = [
  { value: "PK", label: "Pakistan (PK)" },
  { value: "US", label: "United States (US)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "IN", label: "India (IN)" },
  { value: "AE", label: "UAE (AE)" },
];

const LOCALES = [
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
];

// ── Page Component ────────────────────────────────────────────────────────

function TemplatesPageInner() {
  const searchParams = useSearchParams();
  const initialTemplate = searchParams.get("t") ?? "appointment";
  const validTemplate = TEMPLATES.find((t) => t.id === initialTemplate)
    ? initialTemplate
    : "appointment";

  const [templateId, setTemplateId] = useState(validTemplate);
  const [phone, setPhone] = useState("+92");
  const [region, setRegion] = useState("PK");
  const [locale, setLocale] = useState("en");
  const [callerName, setCallerName] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "success" | "error">("idle");
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | undefined>(undefined);
  const [timedOut, setTimedOut] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  const template = TEMPLATES.find((t) => t.id === templateId)!;

  function switchTemplate(id: string) {
    setTemplateId(id);
    setFieldValues({});
    setResult(null);
    setError(null);
    setCallStatus("idle");
    setTimedOut(false);
    setActiveCallId(null);
  }

  function updateField(key: string, value: string | boolean) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCallStatus("calling");
    setTimedOut(false);
    setError(null);
    setResult(null);

    const details: Record<string, unknown> = {};
    for (const f of template.fields) {
      const raw = fieldValues[f.key];
      if (f.type === "checkbox") {
        details[f.key] = Boolean(raw);
      } else if (f.type === "list") {
        details[f.key] = String(raw ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
      } else if (raw) {
        details[f.key] = raw;
      }
    }

    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          recipient: { phone, region, locale },
          user: callerName ? { name: callerName } : {},
          details,
        }),
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        setError(`Unexpected response (${res.status}). Please try again.`);
        setCallStatus("error");
        return;
      }

      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        setCallStatus("error");
        return;
      }

      if (typeof data.quotaRemaining === "number") setQuotaRemaining(data.quotaRemaining);
      setActiveCallId(data.callId);
      await pollTemplateCallStatus(data.callId);
    } catch (err) {
      setError(String(err));
      setCallStatus("error");
    }
  }

  async function pollTemplateCallStatus(callId: string) {
    const POLL_INTERVAL_MS = 5000;
    const MAX_ATTEMPTS = 96; // ~8 minutes

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      try {
        const res = await fetch(`/api/calle/call-status?id=${callId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Could not check call status.");
          setCallStatus("error");
          return;
        }
        if (data.status === "completed") {
          setResult(data.result);
          setCallStatus("success");
          setTimedOut(false);
          return;
        }
        if (data.status === "failed") {
          setError(data.error ?? "The call failed.");
          setCallStatus("error");
          return;
        }
        // "queued" / "in_progress" — keep polling
      } catch (err) {
        // transient network hiccup while polling — keep trying
        continue;
      }
    }

    setError("Still waiting on the call — check back shortly.");
    setTimedOut(true);
    setCallStatus("calling"); // stays on the "calling" UI, with a retry option shown below
  }

  const isActive = callStatus === "calling";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Nav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Choose a template, fill in the details, and CALL-E places the call.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* ── Template selector sidebar ── */}
          <aside className="lg:w-56 shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Choose a template
            </p>
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTemplate(t.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left whitespace-nowrap lg:whitespace-normal transition-colors ${
                    t.id === templateId
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <span className={t.id === templateId ? "text-white" : "text-zinc-400"}>
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Main form ── */}
          <div className="flex-1 min-w-0">
            {/* Template header */}
            <div className="flex items-start justify-between mb-6 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">{template.label}</h2>
                <p className="text-sm text-zinc-500 mt-0.5">{template.description}</p>
              </div>
              <StatusBadge
                status={isActive ? "calling" : callStatus === "success" ? "success" : callStatus === "error" ? "error" : "idle"}
              />
            </div>

            {callStatus === "success" && result ? (
              /* ── Result view ── */
              <div className="flex flex-col gap-4">
                <CallResult result={result} templateId={templateId} quotaRemaining={quotaRemaining} />
                <button
                  onClick={() => {
                    setCallStatus("idle");
                    setResult(null);
                    setError(null);
                    setTimedOut(false);
                    setActiveCallId(null);
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2 text-left"
                >
                  ← Make another call
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                {/* ── Recipient section ── */}
                <Section title="Who to call" description="The phone number CALL-E will dial.">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-3">
                      <FieldLabel htmlFor="phone" label="Phone number" hint="International format — e.g. +923001234567" required />
                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        placeholder="+923001234567"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="region" label="Region" required />
                      <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
                        {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="locale" label="Language" required />
                      <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value)} className={inputCls}>
                        {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="callerName" label="Your name (optional)" hint="CALL-E says 'on behalf of…'" />
                      <input
                        id="callerName"
                        type="text"
                        value={callerName}
                        onChange={(e) => setCallerName(e.target.value)}
                        placeholder="e.g. Rabia"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </Section>

                {/* ── Template fields ── */}
                <Section title="Call details" description="Tell CALL-E what to ask or say.">
                  <div className="flex flex-col gap-5">
                    {template.fields.map((f) => (
                      <TemplateField
                        key={f.key}
                        field={f}
                        value={fieldValues[f.key] ?? (f.type === "checkbox" ? false : "")}
                        onChange={(v) => updateField(f.key, v)}
                      />
                    ))}
                  </div>
                </Section>

                {/* ── Error ── */}
                {error && (
                  <div role="alert" className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* ── Timed out but still checking ── */}
                {timedOut && isActive && (
                  <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <span>This is taking longer than expected. The call may have already completed.</span>
                    {activeCallId && (
                      <button
                        type="button"
                        onClick={() => {
                          setTimedOut(false);
                          pollTemplateCallStatus(activeCallId);
                        }}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                      >
                        Check status again →
                      </button>
                    )}
                  </div>
                )}

                {/* ── Confirm & call ── */}
                <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button
                    type="submit"
                    disabled={isActive || !phone}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isActive ? (
                      <>
                        <LoadingDots color="white" />
                        CALL-E is calling…
                      </>
                    ) : (
                      <>
                        <PhoneIcon small />
                        Place Call
                      </>
                    )}
                  </button>
                  {isActive && !timedOut && (
                    <p className="text-xs text-zinc-400">
                      This can take 1–5 minutes. Please don&apos;t close the page.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <TemplatesPageInner />
    </Suspense>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function FieldLabel({ htmlFor, label, hint, required }: { htmlFor: string; label: string; hint?: string; required?: boolean }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700">
        {label}
        {!required && <span className="ml-1 text-zinc-400 font-normal">(optional)</span>}
      </label>
      {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function TemplateField({ field, value, onChange }: {
  field: FieldDef;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          id={field.key}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <span className="text-sm font-medium text-zinc-700">{field.label}</span>
          {field.hint && <p className="text-xs text-zinc-400 mt-0.5">{field.hint}</p>}
        </div>
      </label>
    );
  }

  return (
    <div>
      <FieldLabel htmlFor={field.key} label={field.label} hint={field.hint} required={!field.optional} />
      {field.type === "textarea" || field.type === "list" ? (
        <textarea
          id={field.key}
          rows={field.type === "list" ? 4 : 3}
          placeholder={field.placeholder}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} resize-y`}
        />
      ) : (
        <input
          id={field.key}
          type="text"
          placeholder={field.placeholder}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
    </div>
  );
}

// ── Shared utilities ──────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

function LoadingDots({ color = "zinc" }: { color?: "white" | "zinc" }) {
  const dotCls = color === "white" ? "bg-white" : "bg-zinc-500";
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`w-1 h-1 rounded-full ${dotCls} animate-bounce`} style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </span>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────

function PhoneIcon({ small }: { small?: boolean }) {
  const s = small ? 15 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2.5 4A1.5 1.5 0 0 1 4 2.5h1.071a.5.5 0 0 1 .485.379l.714 2.5a.5.5 0 0 1-.143.497L5.2 6.8a8.526 8.526 0 0 0 6 6l.925-1.025a.5.5 0 0 1 .497-.143l2.5.714a.5.5 0 0 1 .378.485V14a1.5 1.5 0 0 1-1.5 1.5C6.82 15.5 2.5 11.18 2.5 4Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2 7.5h14M6 2v3M12 2v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.25" />
      <path d="M6.5 6.5l5 5M11.5 6.5l-5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2 5.5l7-3.5 7 3.5v7L9 16l-7-3.5v-7Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M9 2v14M2 5.5l7 3.5 7-3.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 3.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2.5V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 14.5S2.5 10.5 2.5 6.25a3.75 3.75 0 0 1 6.5-2.55A3.75 3.75 0 0 1 15.5 6.25C15.5 10.5 9 14.5 9 14.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}