"use client";

import { useState } from "react";
import Nav from "@/app/components/Nav";
import StatusBadge from "@/app/components/StatusBadge";
import CallResult from "@/app/components/CallResult";
import PhoneInput from "@/app/components/PhoneInput";

// ── Types ─────────────────────────────────────────────────────────────────

type Step = "compose" | "clarify" | "review" | "calling" | "result";

type QA = { question: string; answer: string };

type CycleState = {
  userInput: string;
  planId: string | null;
  callId: string | null;
  readyToRun: boolean;
  clarifyingQuestion: string | null;
  planSummary: string | null;
  planning: boolean;
  finalTask: string;
  placing: boolean;
  timedOut: boolean;
  callResult: any | null;
  qaHistory: QA[];
};

function emptyCycle(prefill = ""): CycleState {
  return {
    userInput: prefill,
    planId: null,
    callId: null,
    readyToRun: false,
    clarifyingQuestion: null,
    planSummary: null,
    planning: false,
    finalTask: "",
    placing: false,
    timedOut: false,
    callResult: null,
    qaHistory: [],
  };
}

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

// ── Main Page ─────────────────────────────────────────────────────────────

export default function CustomCallPage() {
  const [phone, setPhone] = useState("+92");
  const [region, setRegion] = useState("PK");
  const [locale, setLocale] = useState("en");
  const [phase, setPhase] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | undefined>();

  const [cycle1, setCycle1] = useState<CycleState>(emptyCycle());
  const [cycle2, setCycle2] = useState<CycleState>(emptyCycle());
  const [phase1Context, setPhase1Context] = useState<any | null>(null);

  function activeCycle() {
    return phase === 1 ? cycle1 : cycle2;
  }
  function setActiveCycle(updater: (prev: CycleState) => CycleState) {
    if (phase === 1) setCycle1(updater);
    else setCycle2(updater);
  }

  // Derive the current UI step
  function currentStep(): Step {
    const c = activeCycle();
    if (c.callResult) return "result";
    if (c.timedOut) return "calling";
    if (c.placing) return "calling";
    if (c.readyToRun) return "review";
    if (c.planId && c.clarifyingQuestion) return "clarify";
    return "compose";
  }

  // ── MCP: plan call ───────────────────────────────────────────────────────

  async function callPlan(refinement?: string) {
    const cycle = activeCycle();
    const newHistory =
      refinement && cycle.clarifyingQuestion
        ? [...cycle.qaHistory, { question: cycle.clarifyingQuestion, answer: refinement }]
        : cycle.qaHistory;

    setActiveCycle((c) => ({ ...c, planning: true, qaHistory: newHistory }));
    setError(null);

    try {
      const res = await fetch("/api/mcp/plan-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          cycle.planId
            ? { user_input: refinement, plan_id: cycle.planId }
            : { user_input: cycle.userInput, to_phones: [phone] }
        ),
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        setError(`Unexpected response (${res.status}). Please try again.`);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Something went wrong during planning.");
        return;
      }

      const parsed = data.result;
      const ready = Boolean(parsed.ready_to_run);

      const qaText = newHistory.map((qa) => `- ${qa.question} → ${qa.answer}`).join("\n");
      const builtTask = [
        cycle.userInput,
        qaText ? `Additional details:\n${qaText}` : null,
        parsed.summary ? `(CALL-E plan summary: ${parsed.summary})` : null,
      ].filter(Boolean).join("\n\n");

      setActiveCycle((c) => ({
        ...c,
        planId: parsed.plan_id ?? c.planId,
        readyToRun: ready,
        clarifyingQuestion:
          parsed.clarifying_questions?.[0] ?? parsed.clarifying_question ?? null,
        planSummary: parsed.summary ?? c.planSummary,
        finalTask: ready ? builtTask : c.finalTask,
      }));
    } catch (err) {
      setError(String(err));
    } finally {
      setActiveCycle((c) => ({ ...c, planning: false }));
    }
  }

  // ── Place call (create + poll) ──────────────────────────────────────────

  async function placeCall() {
    const cycle = activeCycle();
    if (!cycle.finalTask) return;
    setActiveCycle((c) => ({ ...c, placing: true, timedOut: false }));
    setError(null);

    try {
      const res = await fetch("/api/calle/place-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: cycle.finalTask, recipient: { phone, region, locale } }),
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        setError(`Unexpected response (${res.status}). Please try again.`);
        setActiveCycle((c) => ({ ...c, placing: false }));
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Call could not be placed.");
        setActiveCycle((c) => ({ ...c, placing: false }));
        return;
      }

      if (typeof data.quotaRemaining === "number") setQuotaRemaining(data.quotaRemaining);
      setActiveCycle((c) => ({ ...c, callId: data.callId }));
      await pollCallStatus(data.callId);
    } catch (err) {
      setError(String(err));
      setActiveCycle((c) => ({ ...c, placing: false }));
    }
  }

  async function pollCallStatus(callId: string) {
    const POLL_INTERVAL_MS = 5000;
    const MAX_ATTEMPTS = 96; // ~8 minutes

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      try {
        const res = await fetch(`/api/calle/call-status?id=${callId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Could not check call status.");
          setActiveCycle((c) => ({ ...c, placing: false }));
          return;
        }
        if (data.status === "completed") {
          setActiveCycle((c) => ({ ...c, placing: false, timedOut: false, callResult: data.result }));
          return;
        }
        if (data.status === "failed") {
          setError(data.error ?? "The call failed.");
          setActiveCycle((c) => ({ ...c, placing: false }));
          return;
        }
        // "queued" / "in_progress" — keep polling
      } catch (err) {
        // transient network hiccup while polling — keep trying rather than bailing
        continue;
      }
    }

    setError("Still waiting on the call — check back shortly.");
    setActiveCycle((c) => ({ ...c, placing: false, timedOut: true }));
  }

  // ── Phase 2 ──────────────────────────────────────────────────────────────

  function proceedToPhase2() {
    const result = cycle1.callResult ?? {};
    const context = {
      goal: cycle1.userInput,
      qaHistory: cycle1.qaHistory,
      taskUsed: cycle1.finalTask,
      status: result.status ?? null,
      taskCompleted: result.taskCompleted ?? null,
      evidence: result.evidence ?? [],
    };
    setPhase1Context(context);

    const qaText = context.qaHistory.map((qa) => `- ${qa.question} → ${qa.answer}`).join("\n");
    const evidenceText = context.evidence.length ? context.evidence.join(" ") : "(no evidence)";

    const prefill = [
      "Follow up on the earlier call and confirm the outcome.",
      `Original goal: ${context.goal}`,
      qaText ? `Details clarified:\n${qaText}` : null,
      `Task given to CALL-E:\n${context.taskUsed}`,
      `What happened:\nStatus: ${context.status} — Completed: ${context.taskCompleted}\n${evidenceText}`,
    ].filter(Boolean).join("\n\n");

    setCycle2(emptyCycle(prefill));
    setPhase(2);
  }

  function startOver() {
    setCycle1(emptyCycle());
    setCycle2(emptyCycle());
    setPhase1Context(null);
    setPhase(1);
    setError(null);
    setQuotaRemaining(undefined);
  }

  const cycle = activeCycle();
  const step = currentStep();

  const STEPS: { id: Step; label: string }[] = [
    { id: "compose", label: "Describe" },
    { id: "clarify", label: "Answer" },
    { id: "review", label: "Review" },
    { id: "calling", label: "Calling" },
    { id: "result", label: "Done" },
  ];

  const stepOrder: Step[] = ["compose", "clarify", "review", "calling", "result"];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Custom Call</h1>
            {phase === 2 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                Confirmation call
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            Describe what you need in plain language. CALL-E plans, then you approve before anything is dialed.
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator steps={STEPS} currentStep={step} stepOrder={stepOrder} />

        {/* Recipient (shown only in compose step of phase 1) */}
        {step === "compose" && phase === 1 && (
          <div className="mt-6 rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
              <h2 className="text-sm font-semibold text-zinc-800">Who should CALL-E call?</h2>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Phone number{" "}
                  <span className="text-xs text-zinc-400 font-normal">— select country code, then type number</span>
                </label>
                <PhoneInput
                  id="phone"
                  phone={phone}
                  region={region}
                  onChange={(newPhone, newRegion) => {
                    setPhone(newPhone);
                    setRegion(newRegion);
                  }}
                />
              </div>
              <div className="w-full sm:w-48">
                <label htmlFor="locale" className="block text-sm font-medium text-zinc-700 mb-1.5">Language</label>
                <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value)} className={inputCls}>
                  {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Phase 2 context card */}
        {phase === 2 && phase1Context && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-200">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Context from Phase 1 call
              </h2>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2 text-sm text-zinc-600">
              <p><span className="font-medium text-zinc-900">Goal:</span> {phase1Context.goal}</p>
              <p>
                <span className="font-medium text-zinc-900">Outcome:</span>{" "}
                {phase1Context.status} — task {phase1Context.taskCompleted ? "completed" : "not completed"}
              </p>
              {phase1Context.evidence?.length > 0 && (
                <ul className="flex flex-col gap-1 mt-1">
                  {phase1Context.evidence.map((e: string, i: number) => (
                    <li key={i} className="flex gap-1.5 items-start">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-400 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ── Step: Compose ── */}
        {step === "compose" && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
                <h2 className="text-sm font-semibold text-zinc-800">What do you need CALL-E to do?</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Describe it naturally. CALL-E will ask follow-up questions if needed.
                </p>
              </div>
              <div className="px-5 py-5">
                <textarea
                  rows={5}
                  value={cycle.userInput}
                  onChange={(e) => setActiveCycle((c) => ({ ...c, userInput: e.target.value }))}
                  placeholder={
                    phase === 2
                      ? "Describe what the follow-up call should accomplish…"
                      : "e.g. Call Dr. Khan's clinic and reschedule my appointment from Friday to next Monday afternoon."
                  }
                  className={`${inputCls} resize-y`}
                />
              </div>
            </div>
            <button
              onClick={() => callPlan()}
              disabled={cycle.planning || !cycle.userInput.trim() || !phone.trim()}
              className={primaryBtn}
            >
              {cycle.planning ? (
                <><LoadingDots />&nbsp;CALL-E is planning…</>
              ) : (
                "Plan this call →"
              )}
            </button>
          </div>
        )}

        {/* ── Step: Clarify ── */}
        {step === "clarify" && cycle.clarifyingQuestion && (
          <div className="mt-6 flex flex-col gap-5">
            {/* Conversation history */}
            {cycle.qaHistory.length > 0 && (
              <div className="flex flex-col gap-3">
                {cycle.qaHistory.map((qa, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="self-start max-w-lg px-4 py-3 rounded-xl bg-zinc-100 text-sm text-zinc-700">
                      <span className="text-xs font-semibold text-zinc-400 block mb-1">CALL-E asked</span>
                      {qa.question}
                    </div>
                    <div className="self-end max-w-lg px-4 py-3 rounded-xl bg-zinc-900 text-white text-sm">
                      <span className="text-xs font-semibold text-zinc-400 block mb-1">You answered</span>
                      {qa.answer}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Current question */}
            <div className="rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status="planning" label="CALL-E needs one more detail" />
                </div>
                <p className="text-sm text-zinc-800 font-medium mt-2">{cycle.clarifyingQuestion}</p>
              </div>
              <ClarifyInput
                loading={cycle.planning}
                onSubmit={(val) => callPlan(val)}
              />
            </div>
          </div>
        )}

        {/* ── Step: Review ── */}
        {step === "review" && (
          <div className="mt-6 flex flex-col gap-5">
            {/* Q&A history */}
            {cycle.qaHistory.length > 0 && (
              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Clarified before this call
                  </p>
                </div>
                <ul className="px-5 py-4 flex flex-col gap-2">
                  {cycle.qaHistory.map((qa, i) => (
                    <li key={i} className="text-sm text-zinc-600">
                      <span className="font-medium text-zinc-900">{qa.question}</span>
                      {" → "}
                      {qa.answer}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Editable task */}
            <div className="rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
                <h2 className="text-sm font-semibold text-zinc-800">Review CALL-E&apos;s instructions</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  This is exactly what CALL-E will be told. Edit freely before approving.
                </p>
              </div>
              <div className="px-5 py-5">
                <textarea
                  rows={8}
                  value={cycle.finalTask}
                  onChange={(e) => setActiveCycle((c) => ({ ...c, finalTask: e.target.value }))}
                  className={`${inputCls} resize-y font-mono text-xs`}
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                onClick={placeCall}
                disabled={!cycle.finalTask.trim()}
                className={primaryBtn}
              >
                <PhoneIcon />
                Approve &amp; Place Call
              </button>
              <p className="text-xs text-zinc-400 max-w-xs">
                This places a real phone call to {phone}. It may take 1–5 minutes.
              </p>
            </div>
          </div>
        )}

        {/* ── Step: Calling ── */}
        {step === "calling" && (
          <div className="mt-10 flex flex-col items-center gap-6 text-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <CallingAnimation />
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-900">
                {cycle.timedOut ? "Still checking on your call…" : "CALL-E is calling…"}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {cycle.timedOut
                  ? "This is taking longer than expected. The call may have already completed."
                  : `Dialing ${phone}. This usually takes 1–5 minutes.`}
              </p>
              {!cycle.timedOut && (
                <p className="mt-1 text-xs text-zinc-400">Please keep this page open.</p>
              )}
              {cycle.timedOut && cycle.callId && (
                <button
                  onClick={() => {
                    setActiveCycle((c) => ({ ...c, placing: true, timedOut: false }));
                    pollCallStatus(cycle.callId!);
                  }}
                  className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Check status again →
                </button>
              )}
            </div>
            <StatusBadge status="calling" />
          </div>
        )}

        {/* ── Step: Result ── */}
        {step === "result" && cycle.callResult && (
          <div className="mt-6 flex flex-col gap-5">
            <CallResult
              result={cycle.callResult}
              quotaRemaining={quotaRemaining}
            />

            {phase === 1 && (
              <button
                onClick={proceedToPhase2}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Start a confirmation call →
              </button>
            )}

            <button
              onClick={startOver}
              className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2 text-left"
            >
              Start a new call
            </button>
          </div>
        )}

        {/* Global error */}
        {error && step !== "review" && (
          <div role="alert" className="mt-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  currentStep,
  stepOrder,
}: {
  steps: { id: Step; label: string }[];
  currentStep: Step;
  stepOrder: Step[];
}) {
  const currentIdx = stepOrder.indexOf(currentStep);
  return (
    <div className="flex items-center gap-0" aria-label="Progress">
      {steps.map((s, i) => {
        const idx = stepOrder.indexOf(s.id);
        const done = idx < currentIdx;
        const active = s.id === currentStep;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                  done
                    ? "bg-zinc-900 border-zinc-900 text-white"
                    : active
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-zinc-300 text-zinc-400 bg-white"
                }`}
              >
                {done ? <CheckMini /> : <span>{i + 1}</span>}
              </div>
              <span className={`text-xs mt-1 ${active ? "text-zinc-900 font-medium" : "text-zinc-400"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-8 sm:w-14 mb-4 mx-1 transition-colors ${done ? "bg-zinc-900" : "bg-zinc-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClarifyInput({ onSubmit, loading }: { onSubmit: (val: string) => void; loading: boolean }) {
  const [val, setVal] = useState("");
  return (
    <div className="px-5 py-5 flex flex-col gap-3">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim()) {
            onSubmit(val.trim());
            setVal("");
          }
        }}
        placeholder="Your answer…"
        className={inputCls}
        autoFocus
      />
      <button
        onClick={() => { onSubmit(val.trim()); setVal(""); }}
        disabled={loading || !val.trim()}
        className={primaryBtn}
      >
        {loading ? <><LoadingDots />&nbsp;Thinking…</> : "Send answer →"}
      </button>
    </div>
  );
}

function CallingAnimation() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M5 10.5A2.5 2.5 0 0 1 7.5 8h1.786a.833.833 0 0 1 .808.632l1.19 4.762a.833.833 0 0 1-.238.828L9.5 15.5a15.88 15.88 0 0 0 7 7l1.278-1.546a.833.833 0 0 1 .828-.238l4.762 1.19a.833.833 0 0 1 .632.808V24.5A2.5 2.5 0 0 1 21.5 27C12.387 27 5 19.613 5 10.5Z"
        stroke="#0055ff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-pulse"
      />
    </svg>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

const primaryBtn =
  "flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

function LoadingDots() {
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </span>
  );
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2.5 4A1.5 1.5 0 0 1 4 2.5h1.071a.5.5 0 0 1 .485.379l.714 2.5a.5.5 0 0 1-.143.497L5.2 6.8a8.526 8.526 0 0 0 6 6l.925-1.025a.5.5 0 0 1 .497-.143l2.5.714a.5.5 0 0 1 .378.485V14a1.5 1.5 0 0 1-1.5 1.5C6.82 15.5 2.5 11.18 2.5 4Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckMini() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}