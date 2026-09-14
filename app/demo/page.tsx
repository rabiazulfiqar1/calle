"use client";

import { useState, useEffect } from "react";
import Nav from "@/app/components/Nav";
import StatusBadge from "@/app/components/StatusBadge";
import CallResult from "@/app/components/CallResult";
import { XCircle, MessageSquare } from "lucide-react";

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
    icon: <MessageSquare className="w-4 h-4" />,
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
    icon: <XCircle className="w-4 h-4" />,
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
    label: "Custom call (two-phase flow)",
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
    <div className="min-h-screen flex flex-col bg-surface font-body-base text-on-surface antialiased">
      <Nav />

      <main className="w-full pt-16 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          <div className="w-full max-w-5xl mx-auto px-margin py-margin-desktop">
            {/* Top Context Ribbon & Protocol Tracker */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-xl">
              <div className="flex items-center gap-space-sm">
                <span className="px-2.5 py-1 rounded-full bg-surface-container font-mono-code text-mono-code text-on-surface-variant uppercase tracking-wider">
                  MOD-04 // DEMO_SIMULATOR
                </span>
                <span className="flex items-center gap-1.5 font-body-meta text-body-meta text-success-text font-medium bg-success-bg px-2.5 py-1 rounded-full shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Interactive Simulation Ready
                </span>
              </div>
              <div className="flex items-center gap-space-sm font-body-meta text-body-meta text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-tertiary">tune</span>
                <span>
                  Mode:{" "}
                  <strong className="text-on-surface font-body-medium">
                    Scripted Telephony Sandbox (0ms)
                  </strong>
                </span>
              </div>
            </div>

            {/* Dual Pane Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
              {/* LEFT SIDEBAR: Scenario Catalog Switcher */}
              <aside className="lg:col-span-4 flex flex-col gap-space-lg">
                <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline">
                  <div className="flex items-center justify-between pb-space-md mb-space-sm border-b border-surface-container-low">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                      Scenarios
                    </span>
                    <span className="font-mono-code text-mono-code text-tertiary">
                      {SCENARIOS.length} presets
                    </span>
                  </div>

                  <nav className="flex flex-col gap-space-xs">
                    {SCENARIOS.map((s) => {
                      const isActive = s.id === selectedId;
                      return (
                        <button
                          key={s.id}
                          onClick={() => selectScenario(s.id)}
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
                              {s.icon}
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span
                                className={`font-card-title text-card-title truncate ${
                                  isActive ? "text-canvas-white" : "text-on-surface"
                                }`}
                              >
                                {s.label}
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
                        science
                      </span>
                      <div className="flex flex-col gap-1">
                        <span className="font-card-title text-card-title text-on-surface">
                          Interactive Sandbox
                        </span>
                        <p className="font-body-meta text-body-meta text-on-surface-variant leading-relaxed">
                          Select a scenario above to test CALL-E&apos;s automated voice proxy &amp; negotiation workflows in sandbox mode.
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
                        Simulation Engine
                      </span>
                    </div>
                    <span className="font-mono-code text-mono-code text-primary-fixed-dim">
                      CALL-E Sandbox
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
                    <span>Acoustic Stream</span>
                    <span className="text-success-border font-medium">Active</span>
                  </div>
                </div>
              </aside>

              {/* RIGHT PANE: Dynamic Scenario Execution */}
              <section className="lg:col-span-8 flex flex-col gap-space-lg">
                {/* Header Card */}
                <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-sm">
                  <div className="flex items-start justify-between gap-space-md">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-space-sm">
                        <h1 className="font-section-header text-section-header text-on-surface">
                          {scenario.label}
                        </h1>
                        <span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps uppercase bg-primary-subtle text-primary">
                          Interactive Demo
                        </span>
                      </div>
                      <p className="font-body-base text-body-base text-on-surface-variant">
                        CALL-E will scripted-call this recipient.
                      </p>
                    </div>
                    <StatusBadge
                      status={
                        phase === "calling" ? "calling" : phase === "result" ? "success" : "idle"
                      }
                    />
                  </div>
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
                        className="flex flex-col gap-space-lg"
                        onSubmit={(e) => {
                          e.preventDefault();
                          runDemo();
                        }}
                      >
                        {/* Recipient section */}
                        <Section
                          title="Who to Call"
                          description="Target Dialing Endpoint"
                          stepNumber="01"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                            <div className="flex flex-col gap-1.5">
                              <FieldLabel label="Recipient" required />
                              <input
                                type="text"
                                readOnly
                                value={scenario.recipientName}
                                className={inputCls}
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <FieldLabel label="Phone Number" required />
                              <input
                                type="text"
                                readOnly
                                value={scenario.phone}
                                className={inputCls}
                              />
                            </div>
                          </div>
                        </Section>

                        {/* Call details section */}
                        <Section
                          title="Call Details"
                          description="Intent & Negotiation Logic"
                          stepNumber="02"
                        >
                          <div className="flex flex-col gap-1.5">
                            <FieldLabel label="Goal" required />
                            <textarea
                              readOnly
                              rows={3}
                              value={scenario.goal}
                              className={`${inputCls} resize-none`}
                            />
                          </div>
                        </Section>

                        {/* Bottom Execution Protocol Bar */}
                        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-md">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
                            <div className="flex flex-col gap-1 max-w-md">
                              <div className="flex items-center gap-space-sm">
                                <span className="font-card-title text-card-title text-on-surface">
                                  Execution Protocol
                                </span>
                                <span className="px-2 py-0.5 rounded-full font-mono-code text-mono-code bg-surface-container text-on-surface-variant">
                                  Sandbox Mode
                                </span>
                              </div>
                              <p className="font-body-meta text-body-meta text-on-surface-variant leading-relaxed">
                                This is a scripted demo — no real telephony call will be placed.
                              </p>
                            </div>

                            <button type="submit" className={primaryBtn}>
                              <span className="material-symbols-outlined text-[20px] text-electric-sky animate-pulse">
                                call
                              </span>
                              <span>Place Call</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-space-xs font-body-meta text-body-meta text-tertiary border-t border-surface-container-low">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-success">
                                verified
                              </span>
                              <span>End-to-End Scripted Simulation Sandbox</span>
                            </div>
                            <span className="font-mono-code text-mono-code text-tertiary">
                              LATENCY: 0ms
                            </span>
                          </div>
                        </div>
                      </form>
                    )}

                    {phase === "calling" && (
                      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-border-hairline text-center flex flex-col items-center justify-center gap-space-md py-16">
                        <div className="w-16 h-16 rounded-2xl bg-primary-subtle border border-primary-glow flex items-center justify-center">
                          <CallingAnimation />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="font-section-header text-section-header text-on-surface">
                            CALL-E is calling…
                          </h3>
                          <p className="font-body-base text-body-base text-on-surface-variant">
                            Speaking with {scenario.recipientName}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full font-mono-code text-mono-code bg-surface-container text-on-surface-variant animate-pulse">
                          Simulating Acoustic Stream...
                        </span>
                      </div>
                    )}

                    {phase === "result" && (
                      <div className="flex flex-col gap-space-lg">
                        <CallResult
                          result={{
                            status: "completed",
                            taskCompleted: scenario.taskCompleted,
                            evidence: scenario.evidence,
                            summary: scenario.summary,
                          }}
                        />

                        <Section title="Transcript" description="TELEPHONY_LOG_v1.04">
                          <div className="p-space-md bg-surface-subtle rounded-lg border border-border-hairline">
                            <pre className="whitespace-pre-wrap font-mono-code text-mono-code text-on-surface leading-relaxed">
                              {scenario.transcript}
                            </pre>
                          </div>
                        </Section>

                        <button
                          onClick={reset}
                          className="font-body-medium text-body-medium font-medium text-primary hover:text-brand-mark-blue transition-colors flex items-center gap-1.5 pt-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          <span>Run another demo scenario</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Footer matching Templates */}
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

// ── Two-phase scripted flow (plan → call → carry context → plan → call) ──
type TPPhase =
  | "idle"
  | "plan_call1"
  | "calling1"
  | "result1"
  | "plan_call2"
  | "calling2"
  | "result2";

function RelayMessageIdlePreview({ onSend }: { onSend: () => void }) {
  return (
    <form
      className="flex flex-col gap-space-lg"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <Section title="Who to Call" description="Target Dialing Endpoint" stepNumber="01">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <div className="flex flex-col gap-1.5">
            <FieldLabel label="Phone Number" hint="Select country code, then type number" required />
            <div className="flex gap-2">
              <div className={`${inputCls} flex items-center justify-between shrink-0`}>
                <span>{RELAY_DATA.phone}</span>
                <span className="material-symbols-outlined text-[16px] text-tertiary">
                  arrow_drop_down
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel label="Proxy Speech Accent & Language" required />
            <div className={`${inputCls} flex items-center justify-between`}>
              <span>{RELAY_DATA.language}</span>
              <span className="material-symbols-outlined text-[16px] text-tertiary">
                arrow_drop_down
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Call Details" description="Intent & Message Payload" stepNumber="02">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md mb-space-sm">
          <div className="flex flex-col gap-1.5">
            <FieldLabel label="Who are we calling?" required />
            <input type="text" readOnly value={RELAY_DATA.contactName} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel label="Your relationship to them" />
            <input type="text" readOnly value={RELAY_DATA.relationship} className={inputCls} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-space-sm">
          <FieldLabel label="What should CALL-E say?" required />
          <textarea readOnly rows={3} value={RELAY_DATA.messageToRelay} className={`${inputCls} resize-none`} />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel label="Your name" hint="CALL-E says 'on behalf of…'" />
          <input type="text" readOnly value={RELAY_DATA.callerName} className={inputCls} />
        </div>
      </Section>

      <Section title="Share your location" description="Optional — location consent" stepNumber="03">
        <label className="flex items-center gap-space-sm cursor-default">
          <input
            type="checkbox"
            checked={RELAY_DATA.locationConsent}
            readOnly
            className="w-4 h-4 rounded text-primary focus:ring-primary cursor-default"
          />
          <div className="flex flex-col">
            <span className="font-body-base text-body-base text-on-surface">
              Include my location in the message
            </span>
            <span className="font-body-meta text-body-meta text-on-surface-variant">
              CALL-E will share your address once, clearly, and offer to repeat it.
            </span>
          </div>
        </label>
      </Section>

      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-1 max-w-md">
            <span className="font-card-title text-card-title text-on-surface">
              Execution Protocol
            </span>
            <p className="font-body-meta text-body-meta text-on-surface-variant leading-relaxed">
              This is a scripted demo — no real telephony call will be placed.
            </p>
          </div>

          <button type="submit" className={primaryBtn}>
            <span className="material-symbols-outlined text-[20px] text-electric-sky animate-pulse">
              call
            </span>
            <span>Send Message via CALL-E</span>
          </button>
        </div>
      </div>
    </form>
  );
}

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
    <div className="flex flex-col gap-space-lg">
      {phase === "compose" && (
        <form
          className="flex flex-col gap-space-lg"
          onSubmit={(e) => {
            e.preventDefault();
            runDemo();
          }}
        >
          <Section title="What job do you need done?" description="Scope of Work" stepNumber="01">
            <textarea
              readOnly
              rows={3}
              value={COMPARE_VENDORS_DATA.service}
              className={`${inputCls} resize-none`}
            />
          </Section>

          <Section title="Preferred Timing" description="Schedule Constraints" stepNumber="02">
            <input type="text" readOnly value={COMPARE_VENDORS_DATA.preferredTiming} className={inputCls} />
          </Section>

          <Section title="What should CALL-E ask every vendor?" description="Evaluation Criteria" stepNumber="03">
            <div className="flex flex-col gap-space-sm">
              {COMPARE_VENDORS_DATA.fieldsToAsk.map((f, i) => (
                <input key={i} type="text" readOnly value={f} className={inputCls} />
              ))}
            </div>
          </Section>

          <Section
            title={`Vendors to call (${COMPARE_VENDORS_DATA.vendors.length})`}
            description="Parallel Dialing Queue"
            stepNumber="04"
          >
            <div className="flex flex-col gap-space-md">
              {COMPARE_VENDORS_DATA.vendors.map((v, i) => (
                <div
                  key={i}
                  className="p-space-md rounded-lg border border-border-hairline bg-surface-subtle flex flex-col gap-space-xs"
                >
                  <span className="font-card-title text-card-title text-on-surface">
                    Vendor {i + 1}
                  </span>
                  <input type="text" readOnly value={v.businessName} className={inputCls} />
                  <input type="text" readOnly value={v.phone} className={inputCls} />
                </div>
              ))}
            </div>
          </Section>

          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
              <div className="flex flex-col gap-1 max-w-md">
                <span className="font-card-title text-card-title text-on-surface">
                  Execution Protocol
                </span>
                <p className="font-body-meta text-body-meta text-on-surface-variant leading-relaxed">
                  Parallel call simulation across 3 vendors.
                </p>
              </div>

              <button type="submit" className={primaryBtn}>
                <span className="material-symbols-outlined text-[20px] text-electric-sky animate-pulse">
                  call
                </span>
                <span>Call All Vendors</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {phase === "calling" && (
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-border-hairline text-center flex flex-col items-center justify-center gap-space-md py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary-subtle border border-primary-glow flex items-center justify-center">
            <CallingAnimation />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-section-header text-section-header text-on-surface">
              Calling {COMPARE_VENDORS_DATA.vendors.length} vendors…
            </h3>
            <p className="font-body-base text-body-base text-on-surface-variant">
              CALL-E is speaking with each vendor in parallel and will compare their responses.
            </p>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="flex flex-col gap-space-lg">
          <div className="rounded-xl border border-primary-glow bg-primary-subtle p-space-lg flex flex-col gap-space-xs shadow-2xs">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary">
              Recommended Option
            </span>
            <h3 className="font-section-header text-section-header text-on-surface">
              {COMPARE_VENDORS_DATA.result.winner}
            </h3>
            <p className="font-body-base text-body-base text-on-surface-variant">
              {COMPARE_VENDORS_DATA.result.reasoning}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            {COMPARE_VENDORS_DATA.result.recipients.map((r, i) => {
              const isWinner = r.businessName === COMPARE_VENDORS_DATA.result.winner;
              return (
                <div
                  key={i}
                  className={`p-space-md rounded-xl border flex flex-col gap-space-xs ${
                    isWinner
                      ? "border-primary bg-primary-subtle shadow-xs"
                      : "border-border-hairline bg-surface-container-lowest"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-card-title text-card-title text-on-surface">
                      {r.businessName}
                    </span>
                    <span className="font-mono-code text-mono-code uppercase px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                      {r.outcome}
                    </span>
                  </div>
                  {COMPARE_VENDORS_DATA.fieldsToAsk.map((label, fi) => (
                    <p key={fi} className="font-body-meta text-body-meta text-on-surface-variant">
                      <strong className="text-on-surface font-body-medium">{label}:</strong> {r.fields[fi]}
                    </p>
                  ))}
                  {r.notes && (
                    <p className="font-body-meta text-body-meta italic text-tertiary">{r.notes}</p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={startOver}
            className="font-body-medium text-body-medium font-medium text-primary hover:text-brand-mark-blue transition-colors flex items-center gap-1.5 pt-2"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Run this scenario again</span>
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

  function goToPlanCall1() {
    setPhase("plan_call1");
  }

  function placeCall1() {
    if (!answer.trim()) return;
    setQaHistory([{ question: TWO_PHASE_DATA.clarifyingQuestion, answer }]);
    setPhase("calling1");
    setTimeout(() => setPhase("result1"), 4000);
  }

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
    <div className="flex flex-col gap-space-lg">
      {phase === "idle" && (
        <>
          <Section title="Who to Call" description="Target Endpoint" stepNumber="01">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-1.5">
                <FieldLabel label="Recipient" required />
                <input type="text" readOnly value={TWO_PHASE_DATA.recipientName} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel label="Phone Number" required />
                <input type="text" readOnly value={TWO_PHASE_DATA.phone} className={inputCls} />
              </div>
            </div>
          </Section>

          <Section
            title="Call Goal"
            description="Two-Phase Orchestration Flow"
            stepNumber="02"
          >
            <textarea readOnly rows={3} value={TWO_PHASE_DATA.goal} className={`${inputCls} resize-none`} />
          </Section>

          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
              <div className="flex flex-col gap-1 max-w-md">
                <span className="font-card-title text-card-title text-on-surface">
                  Execution Protocol
                </span>
                <p className="font-body-meta text-body-meta text-on-surface-variant leading-relaxed">
                  Phase 1 will collect slot availability before confirming in Phase 2.
                </p>
              </div>
              <button onClick={goToPlanCall1} className={primaryBtn}>
                <span>Plan Call</span>
              </button>
            </div>
          </div>
        </>
      )}

      {phase === "plan_call1" && (
        <Section
          title="Plan the Call"
          description="Phase 1 Clarification"
          stepNumber="01"
        >
          <div className="flex flex-col gap-space-md">
            <div className="flex flex-col gap-1.5">
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
                <span className="material-symbols-outlined text-[20px] text-electric-sky animate-pulse">
                  call
                </span>
                <span>Place Call</span>
              </button>
            </div>
          </div>
        </Section>
      )}

      {phase === "calling1" && (
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-border-hairline text-center flex flex-col items-center justify-center gap-space-md py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary-subtle border border-primary-glow flex items-center justify-center">
            <CallingAnimation />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-section-header text-section-header text-on-surface">
              CALL-E is calling…
            </h3>
            <p className="font-body-base text-body-base text-on-surface-variant">
              Speaking with {TWO_PHASE_DATA.recipientName}
            </p>
          </div>
        </div>
      )}

      {phase === "result1" && (
        <div className="flex flex-col gap-space-lg">
          <CallResult
            result={{
              status: "completed",
              taskCompleted: TWO_PHASE_DATA.result1.taskCompleted,
              evidence: TWO_PHASE_DATA.result1.evidence,
              summary: TWO_PHASE_DATA.result1.summary,
            }}
          />
          <Section title="Transcript" description="Phase 1 Log">
            <div className="p-space-md bg-surface-subtle rounded-lg border border-border-hairline">
              <pre className="whitespace-pre-wrap font-mono-code text-mono-code text-on-surface leading-relaxed">
                {TWO_PHASE_DATA.transcript1}
              </pre>
            </div>
          </Section>
          <button onClick={goToPlanCall2} className={primaryBtn}>
            <span>Continue to Phase 2 →</span>
          </button>
        </div>
      )}

      {phase === "plan_call2" && (
        <div className="flex flex-col gap-space-lg">
          <Section
            title="Carried from Phase 1"
            description="Preserved Telemetry &amp; Context"
          >
            <div className="flex flex-col gap-space-xs font-body-base text-body-base text-on-surface-variant">
              <p>
                <strong className="text-on-surface font-body-medium">Original goal:</strong> {TWO_PHASE_DATA.goal}
              </p>
              {qaHistory.length > 0 && (
                <div>
                  <p className="text-on-surface font-body-medium mb-1">Clarified before the call:</p>
                  <ul className="list-disc list-inside text-on-surface-variant font-mono-code text-mono-code">
                    {qaHistory.map((qa, i) => (
                      <li key={i}>
                        {qa.question} → {qa.answer}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                <strong className="text-on-surface font-body-medium">Status:</strong> completed ·{" "}
                <strong className="text-on-surface font-body-medium">Task completed:</strong> {String(TWO_PHASE_DATA.result1.taskCompleted)}
              </p>
              <p>
                <strong className="text-on-surface font-body-medium">Summary:</strong> {TWO_PHASE_DATA.result1.summary}
              </p>
            </div>
          </Section>

          <Section
            title="Plan the Confirmation Call"
            description="Phase 2 Task Specification"
          >
            <div className="flex flex-col gap-space-md">
              <textarea
                rows={3}
                value={phase2Task}
                onChange={(e) => setPhase2Task(e.target.value)}
                className={`${editableInputCls} resize-y`}
              />
              <div>
                <button onClick={placeCall2} disabled={!phase2Task.trim()} className={primaryBtn}>
                  <span className="material-symbols-outlined text-[20px] text-electric-sky animate-pulse">
                    call
                  </span>
                  <span>Place Call</span>
                </button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {(phase === "calling2" || phase === "result2") && (
        <Section
          title="Context Carried into Phase 2"
          description="Phase 1 Telemetry Link"
        >
          <div className="flex flex-col gap-space-xs font-body-base text-body-base text-on-surface-variant">
            <p>
              <strong className="text-on-surface font-body-medium">Original goal:</strong> {TWO_PHASE_DATA.goal}
            </p>
            {qaHistory.length > 0 && (
              <div>
                <p className="text-on-surface font-body-medium mb-1">Clarified before the call:</p>
                <ul className="list-disc list-inside text-on-surface-variant font-mono-code text-mono-code">
                  {qaHistory.map((qa, i) => (
                    <li key={i}>
                      {qa.question} → {qa.answer}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p>
              <strong className="text-on-surface font-body-medium">Status:</strong> completed ·{" "}
              <strong className="text-on-surface font-body-medium">Task completed:</strong> {String(TWO_PHASE_DATA.result1.taskCompleted)}
            </p>
            <p>
              <strong className="text-on-surface font-body-medium">Phase 2 call goal:</strong> {phase2Task}
            </p>
          </div>
        </Section>
      )}

      {phase === "calling2" && (
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-border-hairline text-center flex flex-col items-center justify-center gap-space-md py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary-subtle border border-primary-glow flex items-center justify-center">
            <CallingAnimation />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-section-header text-section-header text-on-surface">
              CALL-E is calling to confirm…
            </h3>
            <p className="font-body-base text-body-base text-on-surface-variant">
              Speaking with {TWO_PHASE_DATA.recipientName}
            </p>
          </div>
        </div>
      )}

      {phase === "result2" && (
        <div className="flex flex-col gap-space-lg">
          <CallResult
            result={{
              status: "completed",
              taskCompleted: TWO_PHASE_DATA.result2.taskCompleted,
              evidence: TWO_PHASE_DATA.result2.evidence,
              summary: TWO_PHASE_DATA.result2.summary,
            }}
          />
          <Section title="Transcript" description="Phase 2 Log">
            <div className="p-space-md bg-surface-subtle rounded-lg border border-border-hairline">
              <pre className="whitespace-pre-wrap font-mono-code text-mono-code text-on-surface leading-relaxed">
                {TWO_PHASE_DATA.transcript2}
              </pre>
            </div>
          </Section>
          <button
            onClick={startOver}
            className="font-body-medium text-body-medium font-medium text-primary hover:text-brand-mark-blue transition-colors flex items-center gap-1.5 pt-2"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Run this scenario again</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared UI Helper Components ─────────────────────────────────────────────

function Section({
  title,
  description,
  stepNumber,
  children,
}: {
  title: string;
  description?: string;
  stepNumber?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-border-hairline flex flex-col gap-space-md">
      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-low">
        <div className="flex items-center gap-space-sm">
          {stepNumber && (
            <span className="w-6 h-6 rounded-md bg-surface-container-high flex items-center justify-center font-mono-code text-mono-code text-on-surface font-semibold">
              {stepNumber}
            </span>
          )}
          <h2 className="font-card-title text-card-title text-on-surface">{title}</h2>
        </div>
        {description && (
          <span className="font-body-meta text-body-meta text-on-surface-variant">
            {description}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-space-md">{children}</div>
    </div>
  );
}

function FieldLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
        {label}
        {!required && <span className="text-tertiary ml-1 font-normal uppercase">(Optional)</span>}
      </label>
      {hint && <span className="font-body-meta text-body-meta text-tertiary">{hint}</span>}
    </div>
  );
}

const inputCls =
  "w-full bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none focus:bg-surface-container-lowest cursor-default";

const editableInputCls =
  "w-full bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary";

const primaryBtn =
  "w-full sm:w-auto px-6 py-3 rounded-lg bg-surface-dark text-canvas-white hover:bg-surface-dark-elevated active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-space-sm shrink-0 font-body-medium text-body-medium font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed";

// ── Icons ──────────────────────────────────────────────────────────────────

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