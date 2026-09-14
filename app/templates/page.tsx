"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/app/components/Nav";
import StatusBadge from "@/app/components/StatusBadge";
import PhoneInput from "@/app/components/PhoneInput";
import CallResult from "@/app/components/CallResult";

// ── Template Definitions ──────────────────────────────────────────────────
// Field set / labels / placeholders / hints match the original functional
// templates exactly. iconName / tagline / tagBadge are display-only additions
// for the redesigned card UI and are never sent to the API.

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
  tagline: string;
  iconName: string;
  tagBadge: string;
  fields: FieldDef[];
};

const TEMPLATES: TemplateDef[] = [
  {
    id: "appointment",
    label: "Book an Appointment",
    description: "CALL-E calls and books a time slot on your behalf.",
    tagline: "Clinic, salon, consultation",
    iconName: "calendar_add_on",
    tagBadge: "Pre-Tuned",
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
    tagline: "Gym, utility, subscription",
    iconName: "event_busy",
    tagBadge: "Retention Defense",
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
    tagline: "Delivery tracing, retail inquiry",
    iconName: "local_shipping",
    tagBadge: "IVR Bypass",
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
    tagline: "Dispatch critical one-way alert",
    iconName: "notification_important",
    tagBadge: "Fast Dispatch",
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
    tagline: "Gentle automated check-in",
    iconName: "favorite",
    tagBadge: "Daily Care",
    fields: [
      { key: "personName", label: "Who should CALL-E speak with?", type: "text", placeholder: "e.g. Nana, Uncle Tariq, Mrs. Khan" },
      { key: "thingsToAsk", label: "Topics to cover", type: "list", placeholder: "One topic per line — e.g.\nHow are you feeling today?\nHave you eaten?\nDid you take your medicine?", hint: "CALL-E will raise these naturally, not read them like a script." },
      { key: "reminder", label: "A gentle reminder to pass along", type: "text", placeholder: "e.g. Don't forget your doctor's appointment on Thursday — optional", optional: true },
    ],
  },
];

const LOCALES = [
  { value: "en", label: "English (US) - Warm Business Formal" },
  { value: "ur", label: "Urdu (Standard) - Respectful Formal" },
];

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

  const isCalling = callStatus === "calling";

  return (
    <div className="min-h-screen flex flex-col bg-surface font-body-base text-on-surface antialiased">
      <Nav />

      <main className="w-full pt-16 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          <div className="w-full max-w-5xl mx-auto px-margin py-margin-desktop">
            {/* Top Context Ribbon & Protocol Tracker */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-xl">
              <div className="flex items-center gap-space-sm">
                <span className="px-2.5 py-1 rounded-full bg-surface-container font-mono-code text-mono-code text-on-surface-variant uppercase tracking-wider">
                  MOD-03 // TEMPLATE_ORCHESTRATOR
                </span>
                <span className="flex items-center gap-1.5 font-body-meta text-body-meta text-success-text font-medium bg-success-bg px-2.5 py-1 rounded-full shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Telephony Node v4.2 Ready
                </span>
              </div>
              <div className="flex items-center gap-space-sm font-body-meta text-body-meta text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-tertiary">tune</span>
                <span>
                  Acoustic Profile:{" "}
                  <strong className="text-on-surface font-body-medium">
                    Natural Latency (140ms)
                  </strong>
                </span>
              </div>
            </div>

            {/* Dual Pane Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
              {/* LEFT SIDEBAR: Template Catalog Switcher */}
              <aside className="lg:col-span-4 flex flex-col gap-space-lg">
                <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline">
                  <div className="flex items-center justify-between pb-space-md mb-space-sm border-b border-surface-container-low">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                      Templates
                    </span>
                    <span className="font-mono-code text-mono-code text-tertiary">5 presets</span>
                  </div>

                  <nav className="flex flex-col gap-space-xs">
                    {TEMPLATES.map((t) => {
                      const isActive = t.id === templateId;
                      return (
                        <button
                          key={t.id}
                          onClick={() => switchTemplate(t.id)}
                          type="button"
                          className={`w-full text-left flex items-center justify-between p-space-md rounded-lg transition-all duration-150 group ${
                            isActive
                              ? "bg-surface-dark text-canvas-white shadow-md"
                              : "bg-surface-container-lowest hover:bg-surface-container text-on-surface"
                          }`}
                        >
                          <div className="flex items-center gap-space-md min-w-0">
                            <span
                              className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                                isActive
                                  ? "bg-surface-dark-elevated text-canvas-white"
                                  : "bg-surface-container-high group-hover:bg-surface-container-highest text-on-surface-variant"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {t.iconName}
                              </span>
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span
                                className={`font-card-title text-card-title truncate ${
                                  isActive ? "text-canvas-white" : "text-on-surface"
                                }`}
                              >
                                {t.label}
                              </span>
                              <span
                                className={`font-body-meta text-body-meta truncate ${
                                  isActive ? "text-surface-variant/70" : "text-on-surface-variant"
                                }`}
                              >
                                {t.tagline}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              isActive ? "text-primary-fixed-dim" : "text-tertiary opacity-40"
                            }`}
                          >
                            chevron_right
                          </span>
                        </button>
                      );
                    })}
                  </nav>

                  {/* Tip Box at Sidebar Bottom */}
                  <div className="mt-space-xl p-space-md bg-surface-subtle rounded-lg border border-border-hairline shadow-2xs">
                    <div className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">
                        auto_awesome
                      </span>
                      <div className="flex flex-col gap-1">
                        <span className="font-card-title text-card-title text-on-surface">
                          Need something unique?
                        </span>
                        <p className="font-body-meta text-body-meta text-on-surface-variant leading-relaxed">
                          Try{" "}
                          <Link href="/call" className="text-primary font-medium hover:underline">
                            Custom Call
                          </Link>{" "}
                          for interactive clarifying questions and prompt synthesis.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Telephony Visualizer Micro-Card */}
                <div className="bg-surface-dark rounded-xl p-space-lg text-canvas-white shadow-md relative overflow-hidden">
                  <div className="flex items-center justify-between mb-space-md">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-electric-sky" />
                      <span className="font-label-caps text-label-caps uppercase tracking-wider text-surface-variant">
                        Acoustic Engine
                      </span>
                    </div>
                    <span className="font-mono-code text-mono-code text-primary-fixed-dim">
                      CALL-E Neural Core
                    </span>
                  </div>
                  {/* Frequency Bars */}
                  <div className="h-10 flex items-center justify-between gap-1 px-1">
                    {[12, 24, 32, 16, 28, 36, 20, 32, 12, 24, 28, 8].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 bg-electric-sky rounded-full animate-pulse"
                        style={{ height: `${h}px`, animationDelay: `${i * 0.08}s` }}
                      />
                    ))}
                  </div>
                  <div className="mt-space-sm pt-space-sm flex items-center justify-between text-surface-variant font-mono-code text-mono-code border-t border-surface-dark-border">
                    <span>Adaptive Barge-In</span>
                    <span className="text-success-border font-medium">Active</span>
                  </div>
                </div>
              </aside>

              {/* RIGHT PANE: Dynamic Form & Execution Bar */}
              <section className="lg:col-span-8 flex flex-col gap-space-lg">
                {/* Header Card */}
                <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-sm">
                  <div className="flex items-start justify-between gap-space-md">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-space-sm">
                        <h1 className="font-section-header text-section-header text-on-surface">
                          {template.label}
                        </h1>
                        <span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps uppercase bg-primary-subtle text-primary">
                          {template.tagBadge}
                        </span>
                      </div>
                      <p className="font-body-base text-body-base text-on-surface-variant">
                        {template.description}
                      </p>
                    </div>
                    {/* Status Badge */}
                    <StatusBadge
                      status={
                        isCalling
                          ? "calling"
                          : callStatus === "success"
                          ? "success"
                          : callStatus === "error"
                          ? "error"
                          : "idle"
                      }
                    />
                  </div>
                </div>

                {callStatus === "success" && result ? (
                  /* Result View */
                  <div className="flex flex-col gap-space-md">
                    <CallResult
                      result={result}
                      templateId={templateId}
                      quotaRemaining={quotaRemaining}
                    />
                    <button
                      onClick={() => {
                        setCallStatus("idle");
                        setResult(null);
                        setError(null);
                        setTimedOut(false);
                        setActiveCallId(null);
                      }}
                      className="text-sm font-medium text-primary hover:text-brand-mark-blue transition-colors flex items-center gap-1.5 pt-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                      <span>Place another call with this template</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-space-lg">
                    {/* Section 1: Who to Call */}
                    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-md">
                      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
                        <div className="flex items-center gap-space-sm">
                          <span className="w-6 h-6 rounded-md bg-surface-container-high flex items-center justify-center font-mono-code text-mono-code text-on-surface font-semibold">
                            01
                          </span>
                          <h2 className="font-card-title text-card-title text-on-surface">
                            Who to Call
                          </h2>
                        </div>
                        <span className="font-body-meta text-body-meta text-on-surface-variant">
                          Target Dialing Endpoint
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                        {/* Composite PhoneInput */}
                        <div className="md:col-span-2 flex flex-col gap-1.5">
                          <label
                            htmlFor="phone"
                            className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider"
                          >
                            Recipient Phone Number
                          </label>
                          <PhoneInput
                            id="phone"
                            phone={phone}
                            region={region}
                            onChange={(newPhone, newRegion) => {
                              setPhone(newPhone);
                              setRegion(newRegion);
                            }}
                            required
                          />
                        </div>

                        {/* Language Select */}
                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor="locale"
                            className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider"
                          >
                            Proxy Speech Accent &amp; Language
                          </label>
                          <select
                            id="locale"
                            value={locale}
                            onChange={(e) => setLocale(e.target.value)}
                            className="w-full bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none focus:bg-surface-container-lowest"
                          >
                            {LOCALES.map((l) => (
                              <option key={l.value} value={l.value}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Caller Name */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor="callerName"
                              className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider"
                            >
                              Your name{" "}
                              <span className="normal-case font-normal text-tertiary">(optional)</span>
                            </label>
                          </div>
                          <input
                            id="callerName"
                            type="text"
                            value={callerName}
                            onChange={(e) => setCallerName(e.target.value)}
                            placeholder="e.g. Rabia"
                            className="w-full bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none focus:bg-surface-container-lowest"
                          />
                        </div>
                      </div>

                      {/* Opening Statement Preview */}
                      <div className="mt-space-xs p-space-sm bg-primary-subtle rounded-lg flex items-center gap-space-sm border border-primary-glow">
                        <span className="material-symbols-outlined text-primary text-[18px]">
                          record_voice_over
                        </span>
                        <p className="font-mono-code text-mono-code text-on-primary-fixed leading-snug">
                          CALL-E Opening Statement:{" "}
                          <span className="italic font-medium">
                            &quot;Hello, I am an automated voice proxy calling on behalf of {callerName || "the caller"}...&quot;
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Section 2: Call Details */}
                    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-md">
                      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
                        <div className="flex items-center gap-space-sm">
                          <span className="w-6 h-6 rounded-md bg-surface-container-high flex items-center justify-center font-mono-code text-mono-code text-on-surface font-semibold">
                            02
                          </span>
                          <h2 className="font-card-title text-card-title text-on-surface">
                            Call Details
                          </h2>
                        </div>
                        <span className="font-body-meta text-body-meta text-on-surface-variant">
                          Intent &amp; Negotiation Logic
                        </span>
                      </div>

                      <div className="flex flex-col gap-space-md">
                        {template.fields.map((f) => (
                          <div key={f.key} className="flex flex-col gap-1.5">
                            <label
                              htmlFor={f.key}
                              className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider"
                            >
                              {f.label}
                              {f.optional && (
                                <span className="text-tertiary ml-1 font-normal">(Optional)</span>
                              )}
                            </label>
                            {f.type === "checkbox" ? (
                              <label className="flex items-center gap-2 cursor-pointer pt-1">
                                <input
                                  type="checkbox"
                                  id={f.key}
                                  checked={Boolean(fieldValues[f.key])}
                                  onChange={(e) => updateField(f.key, e.target.checked)}
                                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                                />
                                <span className="font-body-base text-body-base text-on-surface">
                                  {f.label}
                                </span>
                              </label>
                            ) : f.type === "textarea" || f.type === "list" ? (
                              <textarea
                                id={f.key}
                                rows={f.type === "list" ? 4 : 3}
                                placeholder={f.placeholder}
                                value={String(fieldValues[f.key] ?? "")}
                                onChange={(e) => updateField(f.key, e.target.value)}
                                className="w-full bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none focus:bg-surface-container-lowest resize-y"
                              />
                            ) : (
                              <input
                                id={f.key}
                                type="text"
                                placeholder={f.placeholder}
                                value={String(fieldValues[f.key] ?? "")}
                                onChange={(e) => updateField(f.key, e.target.value)}
                                className="w-full bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none focus:bg-surface-container-lowest"
                              />
                            )}
                            {f.hint && (
                              <span className="font-body-meta text-body-meta text-tertiary">
                                {f.hint}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Auto-generated Script Box */}
                      <div className="mt-space-sm rounded-lg overflow-hidden bg-surface-subtle border border-border-hairline shadow-2xs">
                        <div className="bg-surface-container px-space-md py-2 flex items-center justify-between">
                          <span className="font-mono-code text-mono-code text-on-surface-variant">
                            TELEPHONY_PROMPT_v1.04
                          </span>
                          <span className="font-body-meta text-body-meta text-on-surface-variant">
                            Synthesized instructions
                          </span>
                        </div>
                        <div className="p-space-md font-mono-code text-mono-code text-on-surface leading-relaxed">
                          &quot;Goal: Execute {template.label} for {callerName || "user"}. Destination: {phone}. Negotiate respectfully and confirm final status.&quot;
                        </div>
                      </div>
                    </div>

                    {/* Error Banner */}
                    {error && (
                      <div
                        role="alert"
                        className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-sm text-error-text flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">error</span>
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Timed out but still checking — retry, restored from original functionality */}
                    {timedOut && isCalling && (
                      <div className="px-4 py-3 rounded-lg bg-warning-bg border border-warning-border text-sm text-warning-text flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px]">schedule</span>
                          This is taking longer than expected. The call may have already completed.
                        </span>
                        {activeCallId && (
                          <button
                            type="button"
                            onClick={() => {
                              setTimedOut(false);
                              pollTemplateCallStatus(activeCallId);
                            }}
                            className="text-sm font-medium text-primary hover:text-brand-mark-blue whitespace-nowrap flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                            Check status again →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Section 3: Bottom Action & Execution Bar */}
                    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-md">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
                        <div className="flex flex-col gap-1 max-w-md">
                          <div className="flex items-center gap-space-sm">
                            <span className="font-card-title text-card-title text-on-surface">
                              Execution Protocol
                            </span>
                            {typeof quotaRemaining === "number" && (
                              <span className="px-2 py-0.5 rounded-full font-mono-code text-mono-code bg-surface-container text-on-surface-variant">
                                {quotaRemaining}/5 calls left today
                              </span>
                            )}
                          </div>
                          <p className="font-body-meta text-body-meta text-on-surface-variant leading-relaxed">
                            Voice proxy call takes approximately 1–5 minutes. You&apos;ll get live verified evidence and a transcript once it completes.
                            {isCalling && !timedOut && " Please don't close the page."}
                          </p>
                        </div>

                        {/* Primary Trigger Button */}
                        <button
                          type="submit"
                          disabled={isCalling || !phone}
                          className="w-full sm:w-auto px-6 py-3 rounded-lg bg-surface-dark text-canvas-white hover:bg-surface-dark-elevated active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-space-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCalling ? (
                            <>
                              <span className="material-symbols-outlined text-[20px] text-warning animate-spin">
                                progress_activity
                              </span>
                              <span className="font-body-medium text-body-medium font-semibold">
                                {timedOut ? "Still checking…" : "Connecting Telephony Node..."}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[20px] text-electric-sky animate-pulse">
                                call
                              </span>
                              <span className="font-body-medium text-body-medium font-semibold tracking-wide">
                                Place Call via CALL-E
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Security Guarantee */}
                      <div className="flex items-center justify-between pt-space-xs font-body-meta text-body-meta text-tertiary border-t border-surface-container-low">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-success">
                            lock_open_right
                          </span>
                          <span>End-to-End Real-Time Call Telemetry &amp; Encrypted Audio Bridge</span>
                        </div>
                        <span className="font-mono-code text-mono-code text-tertiary">
                          LATENCY: 142ms
                        </span>
                      </div>
                    </div>
                  </form>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-border-hairline py-space-xl mt-auto">
        <div className="max-w-5xl mx-auto px-margin flex flex-col sm:flex-row items-center justify-between gap-space-base">
          <div className="flex items-center gap-space-sm">
            <span className="font-card-title text-card-title text-on-surface">Your Voice</span>
            <span className="font-body-meta text-body-meta text-on-surface-variant">
              — Autonomous Voice Proxy for Accessibility
            </span>
          </div>
          <div className="flex items-center gap-space-lg font-body-meta text-body-meta text-on-surface-variant">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" /> Telephony Node Active
            </span>
            <span>© 2025 Your Voice Systems</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <TemplatesPageInner />
    </Suspense>
  );
}