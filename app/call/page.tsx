"use client";

import { useState } from "react";
import Nav from "@/app/components/Nav";
import PhoneInput from "@/app/components/PhoneInput";
import CallResult from "@/app/components/CallResult";

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
  { value: "en", label: "English (US) - Warm Business Formal" },
  { value: "ur", label: "Urdu (Standard) - Respectful Formal" },
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

  // Derive current UI step
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

  // ── Place call ────────────────────────────────────────────────────────────

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
    const MAX_ATTEMPTS = 96;

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
      } catch (err) {
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

  const stepIndex =
    step === "compose" ? 1 : step === "clarify" ? 2 : step === "review" ? 3 : step === "calling" ? 4 : 5;

  return (
    <div className="min-h-screen flex flex-col bg-surface font-body-base text-on-surface antialiased">
      <Nav />

      <main className="w-full pt-16 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          <div className="max-w-5xl mx-auto w-full px-margin py-space-xl flex flex-col gap-space-2xl">
            {/* Top Stepper Bar */}
            <div className="w-full bg-surface-container-lowest rounded-xl shadow-xs border border-border-hairline p-space-base flex flex-col md:flex-row md:items-center justify-between gap-space-base">
              <div className="flex items-center justify-between w-full overflow-x-auto pb-space-xs md:pb-0">
                {/* Step 1: Describe */}
                <div className="flex items-center gap-space-sm shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xs ${
                      stepIndex > 1
                        ? "bg-success text-on-primary"
                        : stepIndex === 1
                        ? "bg-primary text-on-primary ring-4 ring-primary-subtle"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {stepIndex > 1 ? (
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    ) : (
                      <span className="font-card-title text-card-title">1</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Step 1
                    </span>
                    <span className="font-card-title text-card-title text-on-surface">Describe</span>
                  </div>
                </div>
                <div
                  className={`h-0.5 w-6 sm:w-12 rounded-full mx-2 shrink-0 ${
                    stepIndex > 1 ? "bg-success" : "bg-surface-container-high"
                  }`}
                />

                {/* Step 2: Clarify */}
                <div className="flex items-center gap-space-sm shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xs ${
                      stepIndex > 2
                        ? "bg-success text-on-primary"
                        : stepIndex === 2
                        ? "bg-primary text-on-primary ring-4 ring-primary-subtle"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {stepIndex > 2 ? (
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    ) : (
                      <span className="font-card-title text-card-title">2</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Step 2
                    </span>
                    <span className="font-card-title text-card-title text-on-surface">Clarify</span>
                  </div>
                </div>
                <div
                  className={`h-0.5 w-6 sm:w-12 rounded-full mx-2 shrink-0 ${
                    stepIndex > 2 ? "bg-success" : stepIndex === 2 ? "bg-primary" : "bg-surface-container-high"
                  }`}
                />

                {/* Step 3: Review */}
                <div className="flex items-center gap-space-sm shrink-0 relative">
                  <div className="relative flex items-center justify-center">
                    {stepIndex === 3 && (
                      <span className="absolute inline-flex h-full w-full rounded-full bg-electric-sky opacity-40 animate-ping" />
                    )}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md z-10 ${
                        stepIndex > 3
                          ? "bg-success text-on-primary"
                          : stepIndex === 3
                          ? "bg-primary text-on-primary ring-4 ring-primary-subtle"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {stepIndex > 3 ? (
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      ) : (
                        <span className="font-card-title text-card-title">3</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Step 3
                    </span>
                    <span className="font-card-title text-card-title text-on-surface">Review</span>
                  </div>
                </div>
                <div
                  className={`h-0.5 w-6 sm:w-12 rounded-full mx-2 shrink-0 ${
                    stepIndex > 3 ? "bg-success" : "bg-surface-container-high"
                  }`}
                />

                {/* Step 4: Calling */}
                <div className="flex items-center gap-space-sm shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      stepIndex === 4
                        ? "bg-primary text-on-primary ring-4 ring-primary-subtle animate-pulse"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    <span className="font-card-title text-card-title">4</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Step 4
                    </span>
                    <span className="font-card-title text-card-title text-on-surface-variant">Calling</span>
                  </div>
                </div>
                <div className="h-0.5 w-6 sm:w-12 bg-surface-container-high rounded-full mx-2 shrink-0" />

                {/* Step 5: Done */}
                <div className="flex items-center gap-space-sm shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      stepIndex === 5
                        ? "bg-success text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    <span className="font-card-title text-card-title">5</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Step 5
                    </span>
                    <span className="font-card-title text-card-title text-on-surface-variant">Done</span>
                  </div>
                </div>
              </div>
            </div>


            {/* Phase 2 Context Card */}
            {phase === 2 && phase1Context && (
              <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-border-hairline overflow-hidden">
                <div className="px-space-lg py-space-sm border-b border-border-hairline bg-surface-subtle">
                  <h2 className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
                    Context from Phase 1 call
                  </h2>
                </div>
                <div className="px-space-lg py-space-base flex flex-col gap-space-sm font-body-base text-body-base text-on-surface-variant">
                  <p>
                    <span className="font-medium text-on-surface">Goal:</span> {phase1Context.goal}
                  </p>
                  <p>
                    <span className="font-medium text-on-surface">Outcome:</span>{" "}
                    {phase1Context.status} — task{" "}
                    {phase1Context.taskCompleted ? "completed" : "not completed"}
                  </p>
                  {phase1Context.evidence?.length > 0 && (
                    <ul className="flex flex-col gap-1 mt-1">
                      {phase1Context.evidence.map((e: string, i: number) => (
                        <li key={i} className="flex gap-1.5 items-start">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-outline-variant shrink-0" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 1: Compose ── */}
            {step === "compose" && (
              <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-border-hairline p-space-lg flex flex-col gap-space-lg">
                <div className="flex flex-col gap-space-xs pb-space-md border-b border-border-hairline">
                  <div className="flex items-center gap-space-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <h1 className="font-section-header text-section-header text-on-surface">
                      State Your Custom Telephony Goal
                    </h1>
                  </div>
                  <p className="font-body-meta text-body-meta text-on-surface-variant">
                    Describe what you need in natural everyday language. CALL-E will inspect constraints and formulate an approved telephony script.
                  </p>
                </div>

                <div className="flex flex-col gap-space-lg">
                  {/* Destination & Language */}
                  {phase === 1 && (
                    <div className="flex flex-col sm:flex-row gap-space-lg">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                          Destination Phone Number
                        </label>
                        <PhoneInput
                          phone={phone}
                          region={region}
                          onChange={(p, r) => {
                            setPhone(p);
                            setRegion(r);
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 w-full sm:w-64">
                        <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                          Language
                        </label>
                        <select
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
                    </div>
                  )}

                  {/* Objective Textarea */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                      What should CALL-E accomplish on this call?
                    </label>
                    <textarea
                      rows={5}
                      value={cycle.userInput}
                      onChange={(e) => setActiveCycle((c) => ({ ...c, userInput: e.target.value }))}
                      placeholder={
                        phase === 2
                          ? "Describe what the follow-up call should accomplish…"
                          : "e.g. Call Dr. Khan's clinic and reschedule my appointment from Friday to next Monday afternoon."
                      }
                      className="w-full bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none focus:bg-surface-container-lowest resize-y"
                    />
                  </div>

                  {/* Voice Sandbox & Acoustic Engine Micro-Card (Positioned above action bar) */}
                  <div className="bg-surface-dark rounded-xl px-4 py-3 text-canvas-white shadow-sm border border-surface-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-electric-sky animate-pulse" />
                        <span className="font-label-caps text-xs uppercase tracking-wider text-surface-variant font-semibold">
                          Voice Sandbox
                        </span>
                      </div>
                      <span className="hidden sm:inline text-surface-dark-border font-mono-code text-xs">|</span>
                      <span className="font-mono-code text-xs text-primary-fixed-dim shrink-0">
                        24kHz Neural Core
                      </span>
                    </div>

                    {/* Mini Frequency Waveform Auto Equalizer */}
                    <div className="h-5 flex items-center gap-1 shrink-0">
                      {[8, 14, 18, 10, 16, 20, 12, 18, 8, 14, 16, 6].map((h, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-electric-sky rounded-full animate-pulse"
                          style={{ height: `${h}px`, animationDelay: `${i * 0.08}s` }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-2 font-mono-code text-xs text-surface-variant">
                      <span>Acoustic Stream:</span>
                      <span className="text-success-border font-medium">Active</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-2 border-t border-surface-container-low">
                    <span className="font-mono-code text-mono-code text-on-surface-variant">
                      Zero voice anxiety • 100% human approved
                    </span>
                    <button
                      type="button"
                      onClick={() => callPlan()}
                      disabled={cycle.planning || !cycle.userInput.trim() || !phone.trim()}
                      className="w-full sm:w-auto px-6 py-3 rounded-lg bg-surface-dark text-canvas-white font-body-medium text-body-medium font-semibold flex items-center justify-center gap-space-sm hover:bg-surface-dark-elevated transition-colors shadow-md disabled:opacity-50"
                    >
                      {cycle.planning ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] text-warning animate-spin">
                            progress_activity
                          </span>
                          <span>CALL-E is planning…</span>
                        </>
                      ) : (
                        <>
                          <span>Plan this call with MCP</span>
                          <span className="material-symbols-outlined text-[18px] text-electric-sky">
                            arrow_forward
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* ── STEP 2: Clarify ── */}
            {step === "clarify" && cycle.clarifyingQuestion && (
              <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-border-hairline p-space-lg flex flex-col gap-space-lg">
                <div className="flex items-center justify-between pb-space-md border-b border-border-hairline">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-space-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse" />
                      <h1 className="font-section-header text-section-header text-on-surface">
                        Clarifying Key Parameters
                      </h1>
                    </div>
                    <p className="font-body-meta text-body-meta text-on-surface-variant">
                      CALL-E detected missing details needed to complete this call successfully.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 py-2">
                  {cycle.qaHistory.map((qa, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="self-start max-w-lg px-4 py-3 rounded-xl bg-surface-subtle border border-border-hairline text-sm text-on-surface">
                        <span className="text-xs font-semibold text-primary block mb-1">CALL-E asked:</span>
                        {qa.question}
                      </div>
                      <div className="self-end max-w-lg px-4 py-3 rounded-xl bg-surface-dark text-canvas-white text-sm">
                        <span className="text-xs font-semibold text-surface-variant block mb-1">You answered:</span>
                        {qa.answer}
                      </div>
                    </div>
                  ))}

                  <ClarifyBox
                    question={cycle.clarifyingQuestion}
                    loading={cycle.planning}
                    onSubmit={(val) => callPlan(val)}
                  />
                </div>
              </section>
            )}

            {/* ── STEP 3: Active Review Card ── */}
            {step === "review" && (
              <section className="bg-surface-container-lowest rounded-xl shadow-md border border-border-hairline p-space-lg flex flex-col gap-space-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pb-space-md border-b border-border-hairline">
                  <div className="flex flex-col gap-space-xs">
                    <div className="flex items-center gap-space-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse" />
                      <h1 className="font-section-header text-section-header text-on-surface">
                        Review Call Plan before Dialing
                      </h1>
                    </div>
                    <p className="font-body-meta text-body-meta text-on-surface-variant">
                      CALL-E synthesized your instructions into an exact voice proxy script. Validate every constraint before telephonic initiation.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-space-lg">
                  <div className="bg-surface-subtle p-space-base rounded-xl flex flex-col gap-space-xs shadow-xs border border-border-hairline">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                      Destination Telephony Endpoint
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono-phone text-mono-phone text-on-surface">
                        {phone} ({REGIONS.find((r) => r.value === region)?.label ?? region})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-success-bg text-success-text text-[11px] font-medium border border-success-border">
                        Verified Tel
                      </span>
                    </div>
                  </div>

                  <div className="bg-surface-dark rounded-xl p-space-lg flex flex-col gap-space-base relative overflow-hidden shadow-xl border border-surface-dark-border">
                    <div className="flex items-center justify-between border-b border-surface-dark-border pb-space-sm">
                      <span className="font-mono-code text-[11px] text-surface-variant uppercase tracking-wider">
                        telephony_manifest.prompt
                      </span>
                      <span className="px-2 py-0.5 rounded bg-surface-dark-elevated text-primary-fixed text-[11px] font-mono-code border border-surface-dark-border">
                        Editable
                      </span>
                    </div>
                    <textarea
                      rows={8}
                      value={cycle.finalTask}
                      onChange={(e) => setActiveCycle((c) => ({ ...c, finalTask: e.target.value }))}
                      spellCheck={false}
                      className="w-full bg-surface-dark-elevated text-canvas-white font-mono-code text-mono-code p-space-base rounded-lg border border-surface-dark-border focus:outline-none focus:border-electric-sky focus:ring-1 focus:ring-electric-sky transition-all resize-none leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-space-base pt-space-md border-t border-border-hairline">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-space-base">
                    <button
                      type="button"
                      onClick={() => setActiveCycle((c) => ({ ...c, readyToRun: false, planId: null }))}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-subtle text-on-surface border border-border-hairline font-body-medium text-body-medium flex items-center justify-center gap-space-sm shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                      <span>Back to Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={placeCall}
                      disabled={!cycle.finalTask.trim() || cycle.placing}
                      className="w-full sm:w-auto px-6 py-3 rounded-lg bg-surface-dark hover:bg-surface-dark-elevated text-canvas-white font-body-medium text-body-medium font-semibold flex items-center justify-center gap-space-sm shadow-md transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[20px] text-electric-sky animate-pulse">
                        phone_in_talk
                      </span>
                      <span>Approve &amp; Place Call →</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* ── STEP 4: Calling In Progress ── */}
            {step === "calling" && (
              <section className="bg-surface-container-lowest rounded-xl shadow-md border border-border-hairline p-space-xl flex flex-col items-center justify-center text-center gap-space-lg py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary-subtle border border-primary-glow flex items-center justify-center">
                  <span className="material-symbols-outlined text-[32px] text-primary animate-pulse">
                    phone_in_talk
                  </span>
                </div>

                <div className="flex flex-col gap-1 max-w-md">
                  <h2 className="font-section-header text-section-header text-on-surface">
                    {cycle.timedOut ? "Still checking on your call…" : `CALL-E is Dialing ${phone}`}
                  </h2>
                  <p className="font-body-base text-body-base text-on-surface-variant">
                    {cycle.timedOut
                      ? "This is taking longer than expected. The call may have already completed."
                      : "Your autonomous voice proxy is conversing with the destination. Transcripts will populate automatically."}
                  </p>
                </div>

                {cycle.timedOut && cycle.callId && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCycle((c) => ({ ...c, placing: true, timedOut: false }));
                      pollCallStatus(cycle.callId!);
                    }}
                    className="text-sm font-medium text-primary hover:text-brand-mark-blue transition-colors flex items-center gap-1.5 pt-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    Check status again →
                  </button>
                )}
              </section>
            )}

            {/* ── STEP 5: Call Result ── */}
            {step === "result" && cycle.callResult && (
              <section className="flex flex-col gap-space-md">
                <CallResult result={cycle.callResult} quotaRemaining={quotaRemaining} />

                {phase === 1 && (
                  <button
                    type="button"
                    onClick={proceedToPhase2}
                    className="self-start text-sm font-medium text-primary hover:text-brand-mark-blue transition-colors flex items-center gap-1.5 pt-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    <span>Start a confirmation call →</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={startOver}
                  className="self-start text-sm text-on-surface-variant hover:text-on-surface underline underline-offset-2 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  <span>Start a new call</span>
                </button>
              </section>
            )}

            {/* Global Error Banner */}
            {error && step !== "review" && (
              <div
                role="alert"
                className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-sm text-error-text flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Telemetry Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-base">
              <div className="bg-surface-container-lowest p-space-base rounded-xl shadow-xs border border-border-hairline flex items-center gap-space-base">
                <div className="w-10 h-10 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">hearing_disabled</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body-meta text-body-meta text-on-surface-variant">
                    Assistive Identity
                  </span>
                  <span className="font-card-title text-card-title text-on-surface">
                    FCC Relay Compliant Proxy
                  </span>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-space-base rounded-xl shadow-xs border border-border-hairline flex items-center gap-space-base">
                <div className="w-10 h-10 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">record_voice_over</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body-meta text-body-meta text-on-surface-variant">
                    Transcription Sync
                  </span>
                  <span className="font-card-title text-card-title text-on-surface">
                    Real-Time Live Captioning
                  </span>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-space-base rounded-xl shadow-xs border border-border-hairline flex items-center gap-space-base">
                <div className="w-10 h-10 rounded-lg bg-primary-subtle text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">shield</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body-meta text-body-meta text-on-surface-variant">
                    Emergency Killswitch
                  </span>
                  <span className="font-card-title text-card-title text-on-surface">
                    1-Tap Instant Disconnect
                  </span>
                </div>
              </div>
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

function ClarifyBox({
  question,
  loading,
  onSubmit,
}: {
  question: string;
  loading: boolean;
  onSubmit: (val: string) => void;
}) {
  const [val, setVal] = useState("");
  return (
    <div className="p-4 rounded-xl bg-surface-subtle border border-primary-glow flex flex-col gap-3">
      <div className="flex items-center gap-2 text-primary font-medium text-sm">
        <span className="material-symbols-outlined text-[18px]">help</span>
        <span>{question}</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (val.trim()) {
            onSubmit(val.trim());
            setVal("");
          }
        }}
        className="flex gap-2"
      >
        <input
          name="refinement"
          type="text"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Type your clarification..."
          className="flex-1 bg-surface-container-lowest rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !val.trim()}
          className="px-5 py-2.5 rounded-lg bg-surface-dark text-canvas-white font-body-medium font-semibold hover:bg-surface-dark-elevated transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Submit →"}
        </button>
      </form>
    </div>
  );
}