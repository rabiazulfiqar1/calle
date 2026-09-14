"use client";

import { useState, useEffect } from "react";
import Nav from "@/app/components/Nav";
import StatusBadge from "@/app/components/StatusBadge";
import CallResult from "@/app/components/CallResult";
import { XCircle } from "lucide-react";
import { MessageSquare } from "lucide-react";
// ── Scripted scenarios ───────────────────────────────────────────────────

type DemoScenario = {
  id: string;
  label: string;
  icon: React.ReactNode;
  goal: string;
  recipientName: string;
  phone: string;
  simulatedDelaySeconds: number;
  transcript: string;
  summary: string;
  taskCompleted: boolean;
  evidence: string[];
};

// Scripted data for the "two-phase" flow (plan → call → carry context → plan → call).
// This is illustrative only — no planning API or real call is ever made.
const TWO_PHASE_DATA = {
  goal: "Book a routine checkup at Smile Dental Clinic this week",
  recipientName: "Smile Dental Clinic",
  phone: "+1 276-322-9632",
  clarifyingQuestion: "Which day would you like the appointment?",
  transcript1: `[00:00:00] BOT: Hi, this call is on behalf of a patient who'd like to book a routine dental checkup.
[00:00:04] CLINIC: Sure, let me check our schedule. What day works?
[00:00:08] BOT: Any weekday afternoon this week would be great.
[00:00:13] CLINIC: We have Thursday at 3pm or Friday at 2:30pm available.
[00:00:19] BOT: Perfect, thank you for your help!`,
  result1: {
    summary: "Appointment available for Thursday at 3:00 PM and Friday at 2:30 PM.",
    taskCompleted: true,
    evidence: [
      "The clinic confirmed the Thursday at 3pm and Friday at 2:30pm slots were available.",
    ],
  },
  phase2TaskDefault: "Book the appointment for Thursday at 3pm.",
  transcript2: `[00:00:00] BOT: Hi, following up on the previous call in which there was an available slot this week on Thursday at 3pm — I wanted to book this slot under the name Emma.
[00:00:06] CLINIC: Alright! An appointment under the name Emma has been booked for Thursday at 3:00pm.
[00:00:13] BOT: Great, thank you!`,
  result2: {
    summary: "The appointment was booked for Thursday at 3pm.",
    taskCompleted: true,
    evidence: ["The clinic booked the appointment for Emma."],
  },
};

// Scripted data for the "Relay Message" idle-screen preview, matching the real
// Templates page's field layout exactly (read-only here — just illustrative).
const RELAY_DATA = {
  phone: "+1 276-322-9632",
  language: "English",
  contactName: "Ahmed",
  relationship: "friend",
  messageToRelay:
    "I'm running about 20 minutes late to our meetup. I'm on my way and will share my location so you know where I am.",
  callerName: "Rabia",
  locationConsent: true,
};

// Scripted data for the "Compare Vendors" idle/calling/result flow — mirrors the
// real Compare Vendors page's fields exactly (job, timing, questions, vendors),
// then a scripted parallel-call result with a recommended winner. Entirely
// read-only / scripted here — no /api/call requests are ever made.
const COMPARE_VENDORS_DATA = {
  service: "Fixing a leaking kitchen faucet",
  preferredTiming: "This week, weekday afternoons",
  fieldsToAsk: ["Price", "Availability"],
  vendors: [
    { businessName: "QuickFix Plumbing", phone: "+92 300 1234567" },
    { businessName: "Karachi Plumbers Co", phone: "+92 301 9876543" },
    { businessName: "Reliable Repairs", phone: "+92 333 4567890" },
  ],
  simulatedDelaySeconds: 8,
  result: {
    winner: "Reliable Repairs",
    reasoning:
      "Reliable Repairs quoted the lowest price and could come out the same day, while the other two vendors needed two to three days to schedule.",
    recipients: [
      {
        businessName: "QuickFix Plumbing",
        outcome: "completed",
        fields: ["$45 call-out + $20/hr", "Thursday afternoon"],
        notes: "Mentioned an extra charge if parts need replacing.",
      },
      {
        businessName: "Karachi Plumbers Co",
        outcome: "completed",
        fields: ["$60 flat rate", "Friday morning"],
        notes: "Includes a 30-day workmanship warranty.",
      },
      {
        businessName: "Reliable Repairs",
        outcome: "completed",
        fields: ["$40 flat rate", "Today, within 3 hours"],
        notes: "Fastest availability and lowest price.",
      },
    ],
  },
};

const SCENARIOS: DemoScenario[] = [
  {
    id: "appointment",
    label: "Book a dentist appointment",
    icon: <CalendarIcon />,
    goal: "Book an appointment at Smile Dental Clinic for a routine checkup this week",
    recipientName: "Smile Dental Clinic",
    phone: "+1 276-322-9632",
    simulatedDelaySeconds: 6,
    transcript: `[00:00:00] BOT: Hi, this call is on behalf of a patient who'd like to book a routine dental checkup.
[00:00:04] CLINIC: Sure, let me check our schedule. What day works?
[00:00:08] BOT: Any weekday afternoon this week would be great.
[00:00:13] CLINIC: We have Thursday at 3pm or Friday at 2:30pm available.
[00:00:19] BOT: Thursday at 3pm works well. Could you confirm that's booked?
[00:00:24] CLINIC: Yes, you're confirmed for Thursday at 3pm. Please bring ID and any insurance card.
[00:00:31] BOT: Perfect, thank you for your help!`,
    summary: "Appointment confirmed for Thursday at 3:00 PM. Bring ID and insurance card.",
    taskCompleted: true,
    evidence: [
      "The clinic explicitly confirmed the Thursday 3pm slot was booked.",
      "The clinic requested ID and insurance card for the visit.",
    ],
  },
  {
    id: "relay_message",
    label: "Relay a message to someone",
    icon: <MessageSquare />,
    goal: "Call Ahmed and let him know I'm running 20 minutes late to our meetup, sharing my current location",
    recipientName: "Ahmed",
    phone: "+92 300 1234567",
    simulatedDelaySeconds: 5,
    transcript: `[00:00:00] BOT: Hey Ahmed, quick message from Rabia — she's running about 20 minutes late to your meetup. She's on her way now.
[00:00:07] AHMED: No worries, thanks for letting me know!
[00:00:12] BOT: She'd also like to share her current location so you know exactly where she is — she's near DHA Phase 6, about 15 minutes away.
[00:00:20] AHMED: Got it, that's helpful — see her soon!
[00:00:24] BOT: Great, take care!`,
    summary: "Ahmed was told Rabia is running 20 minutes late, with her current location shared (near DHA Phase 6, ~15 min away).",
    taskCompleted: true,
    evidence: [
      "Ahmed was informed of the 20-minute delay to the meetup.",
      "Ahmed acknowledged receiving Rabia's shared location near DHA Phase 6.",
    ],
  },
  {
    id: "cancel_service",
    label: "Cancel a subscription or service",
    icon: <XCircle />,
    goal: "Cancel a gym membership with FitLife Gym under the account of John Carter, effective at the end of the current billing cycle",
    recipientName: "FitLife Gym Member Services",
    phone: "+1 276-322-9632",
    simulatedDelaySeconds: 5,
    transcript: `[00:00:00] BOT: Hi, I'd like to cancel a gym membership for John Carter, please.
[00:00:05] FitLife Gym: I can help with that. Can you confirm the account email or phone number on file?
[00:00:10] BOT: The phone number on file is 312-555-0199.
[00:00:15] FitLife Gym: Thanks, I found the account. Just to confirm, you'd like to cancel effective immediately or at the end of the billing cycle?
[00:00:21] BOT: At the end of the current billing cycle, please.
[00:00:25] FitLife Gym: Understood. His membership will remain active until the 28th, then it will not renew. You'll receive a confirmation email shortly.
[00:00:33] BOT: That works, thank you for taking care of this.`,
    summary: "John Carter's FitLife Gym membership was cancelled, effective at the end of the current billing cycle (the 28th).",
    taskCompleted: true,
    evidence: [
      "The agent located the account and confirmed the cancellation request.",
      "The membership was set to end on the 28th with no further renewal, and a confirmation email was promised.",
    ],
  },
  {
    id: "order_status",
    label: "Check an order's delivery status",
    icon: <PackageIcon />,
    goal: "Check the status of an order from Daraz — a blue backpack, order reference ORD-98765",
    recipientName: "Daraz Customer Service",
    phone: "+1 276-322-9632",
    simulatedDelaySeconds: 5,
    transcript: `[00:00:00] BOT: Hi, I'm calling to check the status of order ORD-98765, a blue backpack.
[00:00:05] Daraz: One moment, let me pull that up... Yes, I see it. It's out for delivery.
[00:00:12] BOT: Great, do you have an estimated delivery time?
[00:00:16] Daraz: It should arrive by end of day today, likely between 4 and 7pm.
[00:00:22] BOT: Wonderful, thank you for checking!`,
    summary: "Order ORD-98765 is out for delivery, expected between 4-7pm today.",
    taskCompleted: true,
    evidence: [
      "The agent confirmed the order is currently out for delivery.",
      "An estimated delivery window of 4-7pm today was given.",
    ],
  },
  {
    id: "elder_checkup",
    label: "Elder check-in call",
    icon: <HeartIcon />,
    goal: "Have a warm check-in conversation with Abbu, ask how he's feeling and remind him about tomorrow's doctor's appointment",
    recipientName: "Abbu",
    phone: "+1 276-322-9632",
    simulatedDelaySeconds: 7,
    transcript: `[00:00:00] BOT: Hi! Just calling to check in on you today. How are you feeling?
[00:00:06] ABBU: Oh, I'm doing alright, just a bit tired today.
[00:00:11] BOT: I'm glad to hear you're okay. Have you had a chance to eat breakfast?
[00:00:16] ABBU: Yes, I had some tea and toast this morning.
[00:00:21] BOT: That's good. Just a gentle reminder — you have a doctor's appointment tomorrow at 5pm.
[00:00:28] ABBU: Oh right, thank you for reminding me. I almost forgot.
[00:00:33] BOT: Of course! Take care, and I'll check in again soon.`,
    summary: "Abbu is doing okay, slightly tired, had breakfast. Reminded about tomorrow's 5pm doctor's appointment.",
    taskCompleted: true,
    evidence: [
      "Abbu reported feeling tired but generally okay.",
      "Abbu confirmed he had breakfast.",
      "Abbu acknowledged the reminder about tomorrow's appointment.",
    ],
  },
  {
    id: "compare_vendors",
    label: "Compare vendors (parallel calls)",
    icon: <SplitIcon />,
    goal: COMPARE_VENDORS_DATA.service,
    recipientName: `${COMPARE_VENDORS_DATA.vendors.length} vendors`,
    phone: "",
    simulatedDelaySeconds: COMPARE_VENDORS_DATA.simulatedDelaySeconds,
    transcript: "",
    summary: COMPARE_VENDORS_DATA.result.reasoning,
    taskCompleted: true,
    evidence: [],
  },
  {
    id: "Custom call",
    label: "Custom call (phase 1 → plan → call → phase 2 → call)",
    icon: <RepeatIcon />,
    goal: TWO_PHASE_DATA.goal,
    recipientName: TWO_PHASE_DATA.recipientName,
    phone: TWO_PHASE_DATA.phone,
    simulatedDelaySeconds: 4,
    transcript: TWO_PHASE_DATA.transcript1,
    summary: TWO_PHASE_DATA.result1.summary,
    taskCompleted: true,
    evidence: TWO_PHASE_DATA.result1.evidence,
  },
];

type Phase = "idle" | "calling" | "result";

export default function DemoPage() {
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const [phase, setPhase] = useState<Phase>("idle");

  const scenario = SCENARIOS.find((s) => s.id === selectedId)!;

  function selectScenario(id: string) {
    setSelectedId(id);
    setPhase("idle");
  }

  function runDemo() {
    setPhase("calling");
    setTimeout(() => setPhase("result"), scenario.simulatedDelaySeconds * 1000);
  }

  function reset() {
    setPhase("idle");
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Nav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Demo</h1>
        </div>


        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Choose a scenario
            </p>
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectScenario(s.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left whitespace-nowrap lg:whitespace-normal transition-colors ${
                    s.id === selectedId
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <span className={s.id === selectedId ? "text-white" : "text-zinc-400"}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-6 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">{scenario.label}</h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  CALL-E will scripted-call this recipient.
                </p>
              </div>
              <StatusBadge
                status={phase === "calling" ? "calling" : phase === "result" ? "success" : "idle"}
              />
            </div>

            {scenario.id === "Custom call" ? (
              <TwoPhaseScenario key={scenario.id} onStatusChange={setPhase} />
            ) : scenario.id === "compare_vendors" ? (
              <CompareVendorsScenario key={scenario.id} onStatusChange={setPhase} />
            ) : (
              <>
                {phase === "idle" && scenario.id === "relay_message" && (
                  <RelayMessageIdlePreview onSend={runDemo} />
                )}

                {phase === "idle" && scenario.id !== "relay_message" && (
                  <form
                    className="flex flex-col gap-8"
                    onSubmit={(e) => {
                      e.preventDefault();
                      runDemo();
                    }}
                  >
                    {/* ── Recipient section (styled like Templates' "Who to call") ── */}
                    <Section title="Who to call" description="The number CALL-E will dial.">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <FieldLabel label="Recipient" required />
                          <input type="text" readOnly value={scenario.recipientName} className={inputCls} />
                        </div>
                        <div>
                          <FieldLabel label="Phone number" required />
                          <input type="text" readOnly value={scenario.phone} className={inputCls} />
                        </div>
                      </div>
                    </Section>

                    {/* ── Call details section (styled like Templates' "Call details") ── */}
                    <Section title="Call details" description="What CALL-E will say or ask.">
                      <div>
                        <FieldLabel label="Goal" required />
                        <textarea
                          readOnly
                          rows={3}
                          value={scenario.goal}
                          className={`${inputCls} resize-none`}
                        />
                      </div>
                    </Section>

                    {/* ── Confirm & call ── */}
                    <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <button type="submit" className={primaryBtn}>
                        <PhoneIcon />
                        Place Call
                      </button>
                      <p className="text-xs text-zinc-400">This is a scripted demo — no real call is placed.</p>
                    </div>
                  </form>
                )}

                {phase === "calling" && (
                  <div className="mt-4 flex flex-col items-center gap-6 text-center py-10">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                      <CallingAnimation />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-zinc-900">CALL-E is calling…</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Speaking with {scenario.recipientName}
                      </p>
                    </div>
                  </div>
                )}

                {phase === "result" && (
                  <div className="flex flex-col gap-5">
                    <CallResult
                      result={{
                        status: "completed",
                        taskCompleted: scenario.taskCompleted,
                        evidence: scenario.evidence,
                        summary: scenario.summary,
                      }}
                    />

                    <Section title="Transcript" description="A record of the scripted call.">
                      <pre className="whitespace-pre-wrap text-xs font-mono text-zinc-600">
                        {scenario.transcript}
                      </pre>
                    </Section>

                    <button
                      onClick={reset}
                      className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2 text-left"
                    >
                      ← Run another demo
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Two-phase scripted flow (plan → call → carry context → plan → call) ──
// Entirely scripted / client-side. No planning API and no real call is ever made.
// Each phase is a single simple step: type an answer, place the call, see the result.

type TPPhase = "idle" | "plan_call1" | "calling1" | "result1" | "plan_call2" | "calling2" | "result2";

// ── Relay Message idle-screen preview — mirrors the real Templates form layout ──
// (phone + language, who/relationship, message, your name, share-location) so the
// demo genuinely looks like the live template. Entirely read-only / scripted.

function RelayMessageIdlePreview({ onSend }: { onSend: () => void }) {
  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <Section title="Who to call" description="The person CALL-E will reach.">
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel label="Phone number" hint="Select country code, then type number" required />
            <div className="flex gap-2">
              <div className={`${inputCls} w-20 px-2.5 flex items-center justify-between shrink-0`}>
                <span>{RELAY_DATA.phone}</span>
                <span className="text-zinc-400 text-xs">▾</span>
              </div>
            </div>
            </div>
          <div className="max-w-[220px]">
            <FieldLabel label="Language" required />
            <div className={`${inputCls} flex items-center justify-between`}>
              <span>{RELAY_DATA.language}</span>
              <span className="text-zinc-400">▾</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="The message" description="What CALL-E will say.">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Who are we calling?" required />
              <input type="text" readOnly value={RELAY_DATA.contactName} className={inputCls} />
            </div>
            <div>
              <FieldLabel label="Your relationship to them" />
              <input type="text" readOnly value={RELAY_DATA.relationship} className={inputCls} />
            </div>
          </div>

          <div>
            <FieldLabel label="What should CALL-E say?" required />
            <textarea readOnly rows={3} value={RELAY_DATA.messageToRelay} className={`${inputCls} resize-none`} />
          </div>

          <div>
            <FieldLabel label="Your name" hint="CALL-E says 'on behalf of…'" />
            <input type="text" readOnly value={RELAY_DATA.callerName} className={inputCls} />
          </div>
        </div>
      </Section>

      <Section title="Share your location" description="Optional — only if it's relevant to the message.">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={RELAY_DATA.locationConsent}
            readOnly
            className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-blue-600 cursor-default"
          />
          <div>
            <span className="text-sm font-medium text-zinc-700">Include my location in the message</span>
            <p className="text-xs text-zinc-400 mt-0.5">
              CALL-E will share your address once, clearly, and offer to repeat it.
            </p>
          </div>
        </label>
      </Section>

      <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <button type="submit" className={primaryBtn}>
          <PhoneIcon />
          Send Message via CALL-E
        </button>
        <p className="text-xs text-zinc-400">This is a scripted demo — no real call is placed.</p>
      </div>
    </form>
  );
}

// ── Compare Vendors scripted flow — mirrors the real Compare Vendors page ──
// (job, preferred timing, questions to ask, a list of vendors), then simulates
// calling everyone in parallel and shows a scripted winner + per-vendor grid.
// Entirely read-only / scripted here — no /api/call request is ever made.

type CVPhase = "compose" | "calling" | "result";

function CompareVendorsScenario({ onStatusChange }: { onStatusChange: (s: Phase) => void }) {
  const [phase, setPhase] = useState<CVPhase>("compose");

  useEffect(() => {
    const category: Phase = phase === "calling" ? "calling" : phase === "result" ? "result" : "idle";
    onStatusChange(category);
  }, [phase, onStatusChange]);

  function runDemo() {
    setPhase("calling");
    setTimeout(() => setPhase("result"), COMPARE_VENDORS_DATA.simulatedDelaySeconds * 1000);
  }

  function startOver() {
    setPhase("compose");
  }

  return (
    <div className="flex flex-col gap-8">
      {phase === "compose" && (
        <form
          className="flex flex-col gap-8"
          onSubmit={(e) => {
            e.preventDefault();
            runDemo();
          }}
        >
          <Section title="What job do you need done?" description="CALL-E will describe this to every vendor.">
            <textarea
              readOnly
              rows={3}
              value={COMPARE_VENDORS_DATA.service}
              className={`${inputCls} resize-none`}
            />
          </Section>

          <Section title="Preferred timing" description="Optional — shared with every vendor.">
            <input type="text" readOnly value={COMPARE_VENDORS_DATA.preferredTiming} className={inputCls} />
          </Section>

          <Section title="What should CALL-E ask every vendor?" description="The same questions are asked of each vendor, so answers can be compared.">
            <div className="flex flex-col gap-2">
              {COMPARE_VENDORS_DATA.fieldsToAsk.map((f, i) => (
                <input key={i} type="text" readOnly value={f} className={inputCls} />
              ))}
            </div>
          </Section>

          <Section
            title={`Vendors to call (${COMPARE_VENDORS_DATA.vendors.length})`}
            description="CALL-E calls each one in parallel and compares their answers."
          >
            <div className="flex flex-col gap-3">
              {COMPARE_VENDORS_DATA.vendors.map((v, i) => (
                <div key={i} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 flex flex-col gap-3">
                  <span className="text-sm font-semibold text-zinc-800">Vendor {i + 1}</span>
                  <input type="text" readOnly value={v.businessName} className={inputCls} />
                  <input type="text" readOnly value={v.phone} className={inputCls} />
                </div>
              ))}
            </div>
          </Section>

          <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button type="submit" className={primaryBtn}>
              <SplitIcon />
              Call all vendors
            </button>
            <p className="text-xs text-zinc-400">This is a scripted demo — no real calls are placed.</p>
          </div>
        </form>
      )}

      {phase === "calling" && (
        <div className="mt-4 flex flex-col items-center gap-6 text-center py-10">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <CallingAnimation />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-900">
              Calling {COMPARE_VENDORS_DATA.vendors.length} vendors…
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              CALL-E is speaking with each vendor and will compare their answers once every call is done.
            </p>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Recommended</span>
            <h3 className="text-lg font-semibold text-zinc-900">{COMPARE_VENDORS_DATA.result.winner}</h3>
            <p className="text-sm text-zinc-600">{COMPARE_VENDORS_DATA.result.reasoning}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COMPARE_VENDORS_DATA.result.recipients.map((r, i) => {
              const isWinner = r.businessName === COMPARE_VENDORS_DATA.result.winner;
              return (
                <div
                  key={i}
                  className={`p-4 rounded-xl border flex flex-col gap-2 ${
                    isWinner ? "border-blue-300 bg-blue-50/50" : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-800">{r.businessName}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {r.outcome}
                    </span>
                  </div>
                  {COMPARE_VENDORS_DATA.fieldsToAsk.map((label, fi) => (
                    <p key={fi} className="text-xs text-zinc-600">
                      <span className="font-medium text-zinc-800">{label}:</span> {r.fields[fi]}
                    </p>
                  ))}
                  {r.notes && <p className="text-xs italic text-zinc-500">{r.notes}</p>}
                </div>
              );
            })}
          </div>

          <button
            onClick={startOver}
            className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2 text-left"
          >
            ← Run this scenario again
          </button>
        </div>
      )}
    </div>
  );
}

function TwoPhaseScenario({ onStatusChange }: { onStatusChange: (s: Phase) => void }) {
  const [phase, setPhase] = useState<TPPhase>("idle");
  const [answer, setAnswer] = useState("");
  const [qaHistory, setQaHistory] = useState<{ question: string; answer: string }[]>([]);
  const [phase2Task, setPhase2Task] = useState(TWO_PHASE_DATA.phase2TaskDefault);

  useEffect(() => {
    const category: Phase =
      phase === "calling1" || phase === "calling2"
        ? "calling"
        : phase === "result1" || phase === "result2"
        ? "result"
        : "idle";
    onStatusChange(category);
  }, [phase, onStatusChange]);

  // ── Phase 1: plan (ask which day) → place call → scripted result ──
  function goToPlanCall1() {
    setPhase("plan_call1");
  }

  function placeCall1() {
    if (!answer.trim()) return;
    setQaHistory([{ question: TWO_PHASE_DATA.clarifyingQuestion, answer }]);
    setPhase("calling1");
    setTimeout(() => setPhase("result1"), 4000);
  }

  // ── Phase 2: carried context + a single task box → place call once → result ──
  function goToPlanCall2() {
    setPhase("plan_call2");
  }

  function placeCall2() {
    if (!phase2Task.trim()) return;
    setPhase("calling2");
    setTimeout(() => setPhase("result2"), 4000);
  }

  function startOver() {
    setPhase("idle");
    setAnswer("");
    setQaHistory([]);
    setPhase2Task(TWO_PHASE_DATA.phase2TaskDefault);
  }

  return (
    <div className="flex flex-col gap-8">
      {phase === "idle" && (
        <>
          <Section title="Who to call" description="The number CALL-E will dial.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel label="Recipient" required />
                <input type="text" readOnly value={TWO_PHASE_DATA.recipientName} className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Phone number" required />
                <input type="text" readOnly value={TWO_PHASE_DATA.phone} className={inputCls} />
              </div>
            </div>
          </Section>

          <Section
            title="Call goal"
            description="This scenario runs in two phases: plan and place a call, then carry the result into a second plan-and-call step."
          >
            <textarea readOnly rows={3} value={TWO_PHASE_DATA.goal} className={`${inputCls} resize-none`} />
          </Section>

          <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button onClick={goToPlanCall1} className={primaryBtn}>
              Plan Call
            </button>
            <p className="text-xs text-zinc-400">Scripted two-phase demo — no real call is placed.</p>
          </div>
        </>
      )}

      {phase === "plan_call1" && (
        <Section
          title="Plan the call"
          description="Answer this to determine the call instructions, then place the call."
        >
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel label={TWO_PHASE_DATA.clarifyingQuestion} required />
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="e.g. Any weekday afternoon this week"
                className={editableInputCls}
              />
            </div>
            <div>
              <button onClick={placeCall1} disabled={!answer.trim()} className={primaryBtn}>
                <PhoneIcon />
                Place Call
              </button>
            </div>
          </div>
        </Section>
      )}

      {phase === "calling1" && (
        <div className="mt-4 flex flex-col items-center gap-6 text-center py-10">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <CallingAnimation />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-900">CALL-E is calling…</p>
            <p className="mt-1 text-sm text-zinc-500">Speaking with {TWO_PHASE_DATA.recipientName}</p>
          </div>
        </div>
      )}

      {phase === "result1" && (
        <div className="flex flex-col gap-5">
          <CallResult
            result={{
              status: "completed",
              taskCompleted: TWO_PHASE_DATA.result1.taskCompleted,
              evidence: TWO_PHASE_DATA.result1.evidence,
              summary: TWO_PHASE_DATA.result1.summary,
            }}
          />
          <Section title="Transcript" description="A record of the scripted call.">
            <pre className="whitespace-pre-wrap text-xs font-mono text-zinc-600">{TWO_PHASE_DATA.transcript1}</pre>
          </Section>
          <button onClick={goToPlanCall2} className={primaryBtn}>
            Continue to Phase 2 →
          </button>
        </div>
      )}

      {phase === "plan_call2" && (
        <div className="flex flex-col gap-8">
          <Section
            title="Carried from Phase 1"
            description="Everything from the first call, passed along automatically — same as your real proceedToPhase2()."
          >
            <div className="flex flex-col gap-2 text-sm text-zinc-700">
              <p>
                <span className="font-medium">Original goal:</span> {TWO_PHASE_DATA.goal}
              </p>
              {qaHistory.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Clarified before the call:</p>
                  <ul className="list-disc list-inside text-zinc-600">
                    {qaHistory.map((qa, i) => (
                      <li key={i}>
                        {qa.question} → {qa.answer}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                <span className="font-medium">Status:</span> completed ·{" "}
                <span className="font-medium">Task completed:</span> {String(TWO_PHASE_DATA.result1.taskCompleted)}
              </p>
              <p>
                <span className="font-medium">Summary:</span> {TWO_PHASE_DATA.result1.summary}
              </p>
            </div>
          </Section>

          <Section
            title="Plan the confirmation call"
            description="What should this follow-up call do, on top of everything above? Then place the call."
          >
            <div className="flex flex-col gap-4">
              <textarea
                rows={3}
                value={phase2Task}
                onChange={(e) => setPhase2Task(e.target.value)}
                className={`${editableInputCls} resize-y`}
              />
              <div>
                <button onClick={placeCall2} disabled={!phase2Task.trim()} className={primaryBtn}>
                  <PhoneIcon />
                  Place Call
                </button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {(phase === "calling2" || phase === "result2") && (
        <Section
          title="Context carried into phase 2"
          description="Everything from the first call is passed along automatically."
        >
          <div className="flex flex-col gap-2 text-sm text-zinc-700">
            <p>
              <span className="font-medium">Original goal:</span> {TWO_PHASE_DATA.goal}
            </p>
            {qaHistory.length > 0 && (
              <div>
                <p className="font-medium mb-1">Clarified before the call:</p>
                <ul className="list-disc list-inside text-zinc-600">
                  {qaHistory.map((qa, i) => (
                    <li key={i}>
                      {qa.question} → {qa.answer}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p>
              <span className="font-medium">Status:</span> completed ·{" "}
              <span className="font-medium">Task completed:</span> {String(TWO_PHASE_DATA.result1.taskCompleted)}
            </p>
            <p>
              <span className="font-medium">Phase 2 call goal:</span> {phase2Task}
            </p>
          </div>
        </Section>
      )}

      {phase === "calling2" && (
        <div className="mt-4 flex flex-col items-center gap-6 text-center py-10">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <CallingAnimation />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-900">CALL-E is calling to confirm…</p>
            <p className="mt-1 text-sm text-zinc-500">Speaking with {TWO_PHASE_DATA.recipientName}</p>
          </div>
        </div>
      )}

      {phase === "result2" && (
        <div className="flex flex-col gap-5">
          <CallResult
            result={{
              status: "completed",
              taskCompleted: TWO_PHASE_DATA.result2.taskCompleted,
              evidence: TWO_PHASE_DATA.result2.evidence,
              summary: TWO_PHASE_DATA.result2.summary,
            }}
          />
          <Section title="Transcript" description="A record of the scripted confirmation call.">
            <pre className="whitespace-pre-wrap text-xs font-mono text-zinc-600">{TWO_PHASE_DATA.transcript2}</pre>
          </Section>
          <button
            onClick={startOver}
            className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2 text-left"
          >
            ← Run this scenario again
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared UI (Section / FieldLabel / inputCls — borrowed from Templates page) ──

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

function FieldLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="mb-1.5">
      <label className="text-sm font-medium text-zinc-700">
        {label}
        {!required && <span className="ml-1 text-zinc-400 font-normal">(optional)</span>}
      </label>
      {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-zinc-50 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none cursor-default";

const editableInputCls =
  "w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

const primaryBtn =
  "flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

// ── Icons (unchanged, plus SplitIcon for the new scenario) ─────────────────

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

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2.5 4A1.5 1.5 0 0 1 4 2.5h1.071a.5.5 0 0 1 .485.379l.714 2.5a.5.5 0 0 1-.143.497L5.2 6.8a8.526 8.526 0 0 0 6 6l.925-1.025a.5.5 0 0 1 .497-.143l2.5.714a.5.5 0 0 1 .378.485V14a1.5 1.5 0 0 1-1.5 1.5C6.82 15.5 2.5 11.18 2.5 4Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.25" />
      <path d="M9 8v4.5M9 6v.01" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
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

function PackageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2 5.5l7-3.5 7 3.5v7L9 16l-7-3.5v-7Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M9 2v14M2 5.5l7 3.5 7-3.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 4.5L4 6.5l2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13.5l2-2-2-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
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

function SplitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 3.5h3.5L12 10v4.5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 14.5h3.5L12 8V3.5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 2l2.5 1.5L13 5M13 13l2.5 1.5L13 16" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}