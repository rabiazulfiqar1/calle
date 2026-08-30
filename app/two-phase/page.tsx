"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type CycleState = {
  userInput: string;
  planId: string | null;
  readyToRun: boolean;
  clarifyingQuestion: string | null;
  planSummary: string | null;
  planning: boolean;
  finalTask: string;          // editable, human-reviewed before the real call
  placing: boolean;
  callResult: any | null;
  qaHistory: { question: string; answer: string }[];  // tracked client-side, source of truth for finalTask
};

function emptyCycle(prefill = ""): CycleState {
  return {
    userInput: prefill,
    planId: null,
    readyToRun: false,
    clarifyingQuestion: null,
    planSummary: null,
    planning: false,
    finalTask: "",
    placing: false,
    callResult: null,
    qaHistory: [],
  };
}

export default function TwoPhasePage() {
  const [phone, setPhone] = useState("+92");
  const [region, setRegion] = useState("PK");
  const [locale, setLocale] = useState("en");
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);

  const [cycle1, setCycle1] = useState<CycleState>(emptyCycle());
  const [cycle2, setCycle2] = useState<CycleState>(emptyCycle());
  const [phase1Context, setPhase1Context] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  function activeCycle() {
    return step === 1 ? cycle1 : cycle2;
  }
  function setActiveCycle(updater: (prev: CycleState) => CycleState) {
    if (step === 1) setCycle1(updater);
    else setCycle2(updater);
  }

  // ---- MCP plan_call: planning + clarification only, no dialing ----
  async function callPlan(refinement?: string) {
    const cycle = activeCycle();
    // Record this Q&A pair BEFORE sending, so it's never lost even if
    // something about the response is unexpected.
    const newHistory = refinement && cycle.clarifyingQuestion
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

      // Read as text first — avoids a cryptic "Unexpected token '<'" crash
      // if the server returned an HTML error page instead of JSON, and
      // lets us surface the REAL underlying error message.
      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        setError(`Server returned a non-JSON response (status ${res.status}). Raw: ${rawText.slice(0, 300)}`);
        return;
      }

      if (!res.ok) {
        setError(data.error);
        return;
      }
      const parsed = data.result;
      const ready = Boolean(parsed.ready_to_run);

      // Build the final task text OURSELVES from the tracked conversation —
      // don't rely solely on CALL-E's `summary` field, since we don't have
      // a guarantee it folds in every clarified detail. This is the actual
      // fix: the original goal + every Q&A pair, always complete.
      const qaText = newHistory.map((qa) => `- ${qa.question} → ${qa.answer}`).join("\n");
      const builtTask = [
        cycle.userInput,
        qaText ? `Additional details clarified:\n${qaText}` : null,
        parsed.summary ? `(CALL-E's plan summary, for reference: ${parsed.summary})` : null,
      ].filter(Boolean).join("\n\n");

      setActiveCycle((c) => ({
        ...c,
        planId: parsed.plan_id ?? c.planId,
        readyToRun: ready,
        clarifyingQuestion: parsed.clarifying_questions?.[0] ?? parsed.clarifying_question ?? null,
        planSummary: parsed.summary ?? c.planSummary,
        finalTask: ready ? builtTask : c.finalTask,
      }));
    } catch (err) {
      setError(String(err));
    } finally {
      setActiveCycle((c) => ({ ...c, planning: false }));
    }
  }

  // ---- SDK createAndWait: the actual call, same mechanism as templates ----
  async function placeCall() {
    const cycle = activeCycle();
    if (!cycle.finalTask) return;
    setActiveCycle((c) => ({ ...c, placing: true }));
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
        setError(`Server returned a non-JSON response (status ${res.status}). Raw: ${rawText.slice(0, 300)}`);
        return;
      }

      if (!res.ok) {
        setError(data.error);
        return;
      }
      setActiveCycle((c) => ({ ...c, callResult: data.result }));
    } catch (err) {
      setError(String(err));
    } finally {
      setActiveCycle((c) => ({ ...c, placing: false }));
    }
  }

  function proceedToPhase2() {
    const result = cycle1.callResult ?? {};
    // Carry EVERYTHING from phase 1 — the original goal, every clarifying
    // Q&A pair, the exact task instructions that were actually used for
    // the call, and the full result (status/completion/evidence).
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
    const evidenceText = context.evidence.length ? context.evidence.join(" ") : "(no evidence returned)";

    const prefill = [
      `Follow up on the earlier call and confirm the outcome.`,
      ``,
      `Original goal: ${context.goal}`,
      qaText ? `\nDetails clarified before that call:\n${qaText}` : null,
      `\nWhat was actually said/instructed on that call:\n${context.taskUsed}`,
      `\nWhat happened (call result):\nStatus: ${context.status} — Task completed: ${context.taskCompleted}\n${evidenceText}`,
    ].filter(Boolean).join("\n");

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

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Two Phase Work</h1>
        {userEmail && (
          <div style={{ fontSize: 13, color: "#666" }}>
            {userEmail} · <a href="/auth/signout" style={{ color: "#4a90d9" }}>Log out</a>
          </div>
        )}
      </div>
      <p style={{ color: "#666", marginBottom: 16 }}>
        {step === 1 ? "Phase 1 — gathering call" : "Phase 2 — confirmation call"}
        {" · planned via CALL-E MCP, placed via CALL-E SDK"}
      </p>

      {step === 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <label style={{ flex: 2 }}>
            Phone (E.164)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%", padding: 6, marginTop: 4 }} />
          </label>
          <label style={{ flex: 1 }}>
            Region
            <input value={region} onChange={(e) => setRegion(e.target.value)} style={{ width: "100%", padding: 6, marginTop: 4 }} />
          </label>
          <label style={{ flex: 1 }}>
            Locale
            <input value={locale} onChange={(e) => setLocale(e.target.value)} style={{ width: "100%", padding: 6, marginTop: 4 }} />
          </label>
        </div>
      )}

      {step === 2 && phase1Context && (
        <fieldset style={{ border: "1px solid #4a90d9", borderRadius: 8, padding: 16, marginBottom: 16, background: "#0a1a2a" }}>
          <legend style={{ fontWeight: 600 }}>Full context carried from Phase 1</legend>
          <p><strong>Original goal:</strong> {phase1Context.goal}</p>

          {phase1Context.qaHistory?.length > 0 && (
            <>
              <p style={{ marginBottom: 4 }}><strong>Clarified before the call:</strong></p>
              <ul style={{ marginTop: 0 }}>
                {phase1Context.qaHistory.map((qa: { question: string; answer: string }, i: number) => (
                  <li key={i} style={{ fontSize: 13 }}>{qa.question} → {qa.answer}</li>
                ))}
              </ul>
            </>
          )}

          <p style={{ marginBottom: 4 }}><strong>Instructions actually used on the call:</strong></p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#000", padding: 8, borderRadius: 4 }}>
            {phase1Context.taskUsed}
          </pre>

          <p><strong>Status:</strong> {phase1Context.status} · <strong>Task completed:</strong> {String(phase1Context.taskCompleted)}</p>
          {phase1Context.evidence?.length > 0 && (
            <>
              <p style={{ marginBottom: 4 }}><strong>Evidence:</strong></p>
              <ul style={{ marginTop: 0 }}>{phase1Context.evidence.map((e: string, i: number) => <li key={i} style={{ fontSize: 13 }}>{e}</li>)}</ul>
            </>
          )}
        </fieldset>
      )}

      {/* ---- planning (MCP) ---- */}
      {!cycle.planId && (
        <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <legend style={{ fontWeight: 600 }}>Plan the call (MCP)</legend>
          <textarea
            value={cycle.userInput}
            onChange={(e) => setActiveCycle((c) => ({ ...c, userInput: e.target.value }))}
            rows={3}
            style={{ width: "100%", padding: 6 }}
            placeholder="What do you need this call to accomplish?"
          />
          <button
            onClick={() => callPlan()}
            disabled={cycle.planning || !cycle.userInput}
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

      {/* ---- editable final instructions + place call (SDK) ---- */}
      {cycle.planId && cycle.readyToRun && !cycle.callResult && (
        <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <legend style={{ fontWeight: 600 }}>Review & place the call</legend>
          {cycle.qaHistory.length > 0 && (
            <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
              <p style={{ marginBottom: 4 }}><strong>Clarified during planning:</strong></p>
              <ul style={{ marginTop: 0 }}>
                {cycle.qaHistory.map((qa, i) => (
                  <li key={i}>{qa.question} → {qa.answer}</li>
                ))}
              </ul>
            </div>
          )}
          <p style={{ fontSize: 13, color: "#666" }}>
            This is the exact instruction CALL-E will follow — edit if needed before calling.
          </p>
          <textarea
            value={cycle.finalTask}
            onChange={(e) => setActiveCycle((c) => ({ ...c, finalTask: e.target.value }))}
            rows={6}
            style={{ width: "100%", padding: 6 }}
          />
          <button
            onClick={placeCall}
            disabled={cycle.placing || !cycle.finalTask}
            style={{ marginTop: 12, padding: "8px 16px", fontWeight: 600 }}
          >
            {cycle.placing ? "Placing call... (this can take a bit)" : "Approve & Place Call"}
          </button>
        </fieldset>
      )}

      {/* ---- result ---- */}
      {cycle.callResult && (
        <fieldset style={{ border: "1px solid #4a90d9", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <legend style={{ fontWeight: 600 }}>{step === 1 ? "Phase 1 result" : "Phase 2 result"}</legend>
          <p><strong>Status:</strong> {cycle.callResult.status}</p>
          <p><strong>Task completed:</strong> {String(cycle.callResult.taskCompleted)}</p>
          {cycle.callResult.evidence?.length > 0 && (
            <>
              <p style={{ marginBottom: 4 }}><strong>Evidence:</strong></p>
              <ul style={{ marginTop: 0 }}>
                {cycle.callResult.evidence.map((e: string, i: number) => <li key={i} style={{ fontSize: 13 }}>{e}</li>)}
              </ul>
            </>
          )}

          {step === 1 && (
            <button onClick={proceedToPhase2} style={{ marginTop: 12, padding: "8px 16px", fontWeight: 600 }}>
              Review result &rarr; Start confirmation call
            </button>
          )}
          {step === 2 && (
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