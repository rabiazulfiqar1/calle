"use client";

import { useState, useEffect, useCallback } from "react";

const TERMINAL_STATUSES = [
  "COMPLETED", "FAILED", "NO_ANSWER", "DECLINED",
  "CANCELED", "CANCELLED", "VOICEMAIL", "BUSY", "EXPIRED",
];

type CallCycleState = {
  userInput: string;
  planId: string | null;
  confirmToken: string | null;
  readyToRun: boolean;
  clarifyingQuestion: string | null;
  planSummary: string | null;
  planning: boolean;
  runId: string | null;
  running: boolean;
  runStatus: any | null;
  polling: boolean;
};

function emptyCycle(prefill = ""): CallCycleState {
  return {
    userInput: prefill,
    planId: null,
    confirmToken: null,
    readyToRun: false,
    clarifyingQuestion: null,
    planSummary: null,
    planning: false,
    runId: null,
    running: false,
    runStatus: null,
    polling: false,
  };
}

function isTerminal(status: string | undefined) {
  return Boolean(status && TERMINAL_STATUSES.includes(status.toUpperCase()));
}

export default function TwoPhasePage() {
  const [phone, setPhone] = useState("+92");
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);

  const [cycle1, setCycle1] = useState<CallCycleState>(emptyCycle());
  const [cycle2, setCycle2] = useState<CallCycleState>(emptyCycle());
  // Persisted separately from cycle2's editable textarea, so the gathered
  // context from call 1 stays visible and intact even if the user edits
  // the phase 2 goal text.
  const [phase1Context, setPhase1Context] = useState<any | null>(null);

  function activeCycle() {
    return step === 1 ? cycle1 : cycle2;
  }
  function setActiveCycle(updater: (prev: CallCycleState) => CallCycleState) {
    if (step === 1) setCycle1(updater);
    else setCycle2(updater);
  }

  async function callPlan(refinement?: string) {
    const cycle = activeCycle();
    setActiveCycle((c) => ({ ...c, planning: true }));
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      const parsed = data.result;
      setActiveCycle((c) => ({
        ...c,
        planId: parsed.plan_id ?? c.planId,
        confirmToken: parsed.confirm_token ?? c.confirmToken,
        readyToRun: Boolean(parsed.ready_to_run),
        clarifyingQuestion: parsed.clarifying_questions?.[0] ?? parsed.clarifying_question ?? null,
        planSummary: parsed.summary ?? c.planSummary,
      }));
    } catch (err) {
      setError(String(err));
    } finally {
      setActiveCycle((c) => ({ ...c, planning: false }));
    }
  }

  async function handleRun() {
    const cycle = activeCycle();
    if (!cycle.planId || !cycle.confirmToken) return;
    setActiveCycle((c) => ({ ...c, running: true }));
    setError(null);
    try {
      const res = await fetch("/api/mcp/run-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: cycle.planId, confirm_token: cycle.confirmToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setActiveCycle((c) => ({ ...c, runId: data.result.run_id }));
    } catch (err) {
      setError(String(err));
    } finally {
      setActiveCycle((c) => ({ ...c, running: false }));
    }
  }

  async function pollStatus() {
    const cycle = activeCycle();
    if (!cycle.runId) return;
    setActiveCycle((c) => ({ ...c, polling: true }));
    setError(null);
    try {
      const res = await fetch("/api/mcp/get-call-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: cycle.runId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setActiveCycle((c) => ({ ...c, runStatus: data.result }));
    } catch (err) {
      setError(String(err));
    } finally {
      setActiveCycle((c) => ({ ...c, polling: false }));
    }
  }

  // Auto-polling: removes the need to manually click "Check Status" —
  // follows CALL-E's documented cadence (first check ~60s after the run
  // starts, then every ~8s) and stops automatically once terminal.
  // This doesn't speed up CALL-E's own call time, but it removes the
  // extra delay of waiting for a human to notice and click a button.
  useEffect(() => {
    const cur = activeCycle();
    if (!cur.runId || (cur.runStatus && isTerminal(cur.runStatus.status))) return;

    const hasCheckedOnce = Boolean(cur.runStatus);
    const delay = hasCheckedOnce ? 8000 : 60000;

    const timer = setTimeout(() => {
      pollStatus();
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cycle1.runId, cycle1.runStatus, cycle2.runId, cycle2.runStatus]);

  function proceedToPhase2() {
    const status = cycle1.runStatus ?? {};
    const result = status.result ?? {};
    // Persist a structured snapshot of what call 1 actually found —
    // this is what "carries" the gathered context into phase 2.
    const context = {
      status: status.status ?? null,
      summary: result.summary ?? result.post_summary ?? null,
      taskCompleted: result.outcome?.task_completed ?? null,
      evidence: result.outcome?.evidence ?? [],
      transcript: result.transcript ?? null,
      goal: cycle1.userInput,
    };
    setPhase1Context(context);

    const contextLines = [
      context.summary ? `Summary: ${context.summary}` : null,
      context.taskCompleted !== null ? `Task completed: ${context.taskCompleted}` : null,
      context.evidence.length ? `Evidence: ${context.evidence.join(" | ")}` : null,
    ].filter(Boolean).join("\n");

    const prefill = `Follow up on the earlier call and confirm the outcome.\n\nContext from that call:\n${contextLines || "(no summary returned)"}`;
    setCycle2(emptyCycle(prefill));
    setStep(2);
  }

  function startOver() {
    setCycle1(emptyCycle());
    setCycle2(emptyCycle());
    setPhase1Context(null);
    setStep(1);
    setError(null);
  }

  const cycle = activeCycle();
  const cycleDone = cycle.runStatus && isTerminal(cycle.runStatus.status);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Two Phase Work</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>
        {step === 1 ? "Phase 1 — gathering call" : "Phase 2 — confirmation call"}
      </p>

      {step === 1 && (
        <label style={{ display: "block", marginBottom: 12 }}>
          Phone (E.164)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%", padding: 6, marginTop: 4 }} />
        </label>
      )}

      {/* Pinned reference card — the actual "gathered context" from call 1,
          visible throughout phase 2 regardless of what the user edits in
          the goal textarea below. */}
      {step === 2 && phase1Context && (
        <fieldset style={{ border: "1px solid #4a90d9", borderRadius: 8, padding: 16, marginBottom: 16, background: "#0a1a2a" }}>
          <legend style={{ fontWeight: 600 }}>Context carried from Phase 1</legend>
          <p><strong>Original goal:</strong> {phase1Context.goal}</p>
          {phase1Context.summary && <p><strong>Summary:</strong> {phase1Context.summary}</p>}
          {phase1Context.taskCompleted !== null && (
            <p><strong>Task completed:</strong> {String(phase1Context.taskCompleted)}</p>
          )}
          {phase1Context.evidence?.length > 0 && (
            <ul>
              {phase1Context.evidence.map((e: string, i: number) => <li key={i} style={{ fontSize: 13 }}>{e}</li>)}
            </ul>
          )}
        </fieldset>
      )}

      {!cycle.planId && (
        <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <legend style={{ fontWeight: 600 }}>Plan the call</legend>
          <textarea
            value={cycle.userInput}
            onChange={(e) => setActiveCycle((c) => ({ ...c, userInput: e.target.value }))}
            rows={3}
            style={{ width: "100%", padding: 6 }}
            placeholder="What do you need this call to accomplish?"
          />
          <button
            onClick={() => callPlan()}
            disabled={cycle.planning || !cycle.userInput || (step === 1 && !phone)}
            style={{ marginTop: 12, padding: "8px 16px", fontWeight: 600 }}
          >
            {cycle.planning ? "Planning..." : "Plan Call"}
          </button>
        </fieldset>
      )}

      {cycle.planId && !cycle.readyToRun && cycle.clarifyingQuestion && (
        <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <legend style={{ fontWeight: 600 }}>CALL-E needs more info</legend>
          <p>{cycle.clarifyingQuestion}</p>
          <RefinementInput onSubmit={(val) => callPlan(val)} loading={cycle.planning} />
        </fieldset>
      )}

      {cycle.planId && cycle.readyToRun && !cycle.runId && (
        <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <legend style={{ fontWeight: 600 }}>Approve & call</legend>
          {cycle.planSummary && <p><strong>Plan:</strong> {cycle.planSummary}</p>}
          <button onClick={handleRun} disabled={cycle.running} style={{ padding: "8px 16px", fontWeight: 600 }}>
            {cycle.running ? "Placing call..." : "Approve & Run Call"}
          </button>
        </fieldset>
      )}

      {cycle.runId && (
        <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <legend style={{ fontWeight: 600 }}>Call in progress</legend>
          <p style={{ color: "#666" }}>Run ID: {cycle.runId}</p>
          {!cycleDone && (
            <p style={{ color: "#4a90d9", fontSize: 13 }}>
              {cycle.polling ? "Checking status..." : "Auto-checking every ~8s (first check ~60s after the call starts)"}
            </p>
          )}
          <button onClick={pollStatus} disabled={cycle.polling} style={{ padding: "8px 16px" }}>
            {cycle.polling ? "Checking..." : "Check Now"}
          </button>
          {cycle.runStatus && (
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, marginTop: 12 }}>
              {JSON.stringify(cycle.runStatus, null, 2)}
            </pre>
          )}

          {cycleDone && (
            <div style={{ marginTop: 16, padding: 12, border: "1px solid #4a90d9", borderRadius: 6 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>
                {step === 1 ? "This is what will carry into Phase 2:" : "Phase 2 result:"}
              </p>
              <p><strong>Status:</strong> {cycle.runStatus.status}</p>
              {cycle.runStatus.result?.summary && <p><strong>Summary:</strong> {cycle.runStatus.result.summary}</p>}
              {cycle.runStatus.result?.outcome && (
                <>
                  <p><strong>Task completed:</strong> {String(cycle.runStatus.result.outcome.task_completed)}</p>
                  {cycle.runStatus.result.outcome.evidence?.length > 0 && (
                    <>
                      <p style={{ marginBottom: 4 }}><strong>Evidence:</strong></p>
                      <ul style={{ marginTop: 0 }}>
                        {cycle.runStatus.result.outcome.evidence.map((e: string, i: number) => (
                          <li key={i} style={{ fontSize: 13 }}>{e}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {cycleDone && step === 1 && (
            <button onClick={proceedToPhase2} style={{ marginTop: 12, padding: "8px 16px", fontWeight: 600 }}>
              Review result &rarr; Start confirmation call
            </button>
          )}
          {cycleDone && step === 2 && (
            <button onClick={startOver} style={{ marginTop: 12, padding: "8px 16px" }}>
              Start a new two-phase call
            </button>
          )}
        </fieldset>
      )}

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}
    </main>
  );
}

function RefinementInput({ onSubmit, loading }: { onSubmit: (val: string) => void; loading: boolean }) {
  const [val, setVal] = useState("");
  return (
    <>
      <input value={val} onChange={(e) => setVal(e.target.value)} style={{ width: "100%", padding: 6 }} />
      <button
        onClick={() => { onSubmit(val); setVal(""); }}
        disabled={loading || !val}
        style={{ marginTop: 12, padding: "8px 16px" }}
      >
        {loading ? "Sending..." : "Answer"}
      </button>
    </>
  );
}