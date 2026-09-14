"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/app/components/Nav";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("Rabia");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email ?? null;
      setEmail(userEmail);
      if (userEmail) {
        const namePart = userEmail.split("@")[0];
        setFirstName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
      }
    });
  }, []);

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen flex flex-col bg-surface font-body-base text-on-surface antialiased">
      <Nav />

      <main className="w-full pt-16 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          <div className="max-w-5xl mx-auto w-full px-margin py-margin-desktop space-y-space-3xl">
            {/* Greeting & Telephony Diagnostic Engine Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-xl">
              <div className="space-y-space-xs max-w-xl">
                <div className="inline-flex items-center gap-space-xs px-2.5 py-1 rounded-full bg-primary-subtle text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="font-label-caps text-label-caps uppercase tracking-wider">
                    Telephony Node US-EAST-04
                  </span>
                </div>
                <h1 className="font-page-header text-page-header text-on-surface tracking-tight">
                  {timeGreeting}, {firstName}
                </h1>
                <p className="font-body-base text-body-base text-on-surface-variant">
                  What would you like CALL-E to autonomously orchestrate for you today?
                </p>
              </div>

              {/* Quick Action Dial / Metrics Pill */}
              <div className="flex items-center gap-space-sm bg-surface-container-lowest p-2 rounded-xl shadow-xs border border-border-hairline">
                <div className="flex flex-col px-3 py-1">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                    Active Voice Model
                  </span>
                  <span className="font-mono-code text-mono-code font-medium text-on-surface">
                    Neural-Acoustic v3.2
                  </span>
                </div>
                <div className="h-8 w-px bg-surface-container-highest" />
                <Link
                  href="/call"
                  className="flex items-center gap-space-xs px-3.5 py-2 rounded-lg bg-primary text-on-primary font-body-medium text-body-medium hover:bg-brand-mark-blue transition-colors shadow-xs active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">add_call</span>
                  <span>New Proxy Call</span>
                </Link>
              </div>
            </div>

            {/* Acoustic Voice Pulse & Live Telephony Well */}
            <div className="relative overflow-hidden rounded-xl bg-surface-dark p-space-xl text-canvas-white shadow-xl">
              <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-primary-container/20 blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg">
                <div className="flex items-start gap-space-md">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-surface-dark-elevated">
                    <span className="material-symbols-outlined text-electric-sky text-[22px]">
                      graphic_eq
                    </span>
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-success" />
                  </div>
                  <div>
                    <div className="flex items-center gap-space-sm">
                      <span className="font-card-title text-card-title text-canvas-white">
                        Voice Engine: Ready
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps uppercase bg-success-bg text-success-text">
                        Low Latency Active
                      </span>
                    </div>
                    <p className="font-body-meta text-body-meta text-surface-variant mt-0.5">
                      Dual-channel acoustic synthesizer with human cadence preservation and dynamic silence masking.
                    </p>
                  </div>
                </div>

                {/* 20-Bar Acoustic Equalizer */}
                <div className="flex items-center gap-1 h-8 px-4 py-1.5 rounded-lg bg-surface-dark-elevated">
                  {[8, 16, 24, 12, 20, 28, 16, 32, 20, 12, 24, 8, 20, 28, 16, 12, 24, 16, 8, 20].map(
                    (height, i) => (
                      <div
                        key={i}
                        className="w-1 bg-electric-sky rounded-full animate-pulse"
                        style={{
                          height: `${height}px`,
                          animationDuration: `${0.6 + (i % 6) * 0.2}s`,
                        }}
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            {/* 6 Interactive Voice Proxy Module Cards */}
            <div className="space-y-space-base">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-section-header text-section-header text-on-surface">
                    Voice Proxy Modules
                  </h2>
                  <p className="font-body-meta text-body-meta text-on-surface-variant">
                    Select an autonomous directive or initiate an unrestricted custom instruction.
                  </p>
                </div>
                <span className="font-mono-code text-mono-code text-on-surface-variant">
                  6 Available Flows
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
                {/* Card 1: Book an Appointment */}
                <Link
                  href="/templates?t=appointment"
                  className="group relative flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest border border-border-hairline shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="space-y-space-md">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg bg-surface-subtle flex items-center justify-center text-on-surface group-hover:bg-primary-subtle group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                        arrow_forward
                      </span>
                    </div>
                    <div>
                      <h3 className="font-card-title text-card-title text-on-surface group-hover:text-primary transition-colors">
                        Book an Appointment
                      </h3>
                      <p className="font-body-base text-body-base text-on-surface-variant mt-1.5 leading-relaxed">
                        CALL-E calls the clinic or salon, inquires about openings, and locks in your preferred time slot.
                      </p>
                    </div>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-surface-container-low flex items-center gap-space-xs font-label-caps text-label-caps uppercase text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">event_available</span>
                    <span>Syncs with Google / Apple Calendar</span>
                  </div>
                </Link>

                {/* Card 2: Custom Call (Accent Hero Card) */}
                <Link
                  href="/call"
                  className="group relative flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest border border-border-hairline shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="space-y-space-md">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg bg-primary-subtle flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps uppercase bg-primary-subtle text-primary border border-primary-glow">
                        Flexible Flow
                      </span>
                    </div>
                    <div>
                      <h3 className="font-card-title text-card-title text-on-surface group-hover:text-primary transition-colors">
                        Custom Call
                      </h3>
                      <p className="font-body-base text-body-base text-on-surface-variant mt-1.5 leading-relaxed">
                        Two-phase autonomous call: state any complex objective, inspect the synthesized prompt, and approve before dialing.
                      </p>
                    </div>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-surface-container-low flex items-center justify-between font-label-caps text-label-caps uppercase text-primary">
                    <span className="flex items-center gap-space-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Human-in-the-Loop Review</span>
                    </span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </div>
                </Link>

                {/* Card 3: Check Order Status */}
                <Link
                  href="/templates?t=order_status"
                  className="group relative flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest border border-border-hairline shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="space-y-space-md">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg bg-surface-subtle flex items-center justify-center text-on-surface group-hover:bg-primary-subtle group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">package_2</span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                        arrow_forward
                      </span>
                    </div>
                    <div>
                      <h3 className="font-card-title text-card-title text-on-surface group-hover:text-primary transition-colors">
                        Check Order Status
                      </h3>
                      <p className="font-body-base text-body-base text-on-surface-variant mt-1.5 leading-relaxed">
                        Tracks deliveries, provides reference IDs, negotiates gate drop-offs, and verifies arrival windows.
                      </p>
                    </div>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-surface-container-low flex items-center gap-space-xs font-label-caps text-label-caps uppercase text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">barcode_scanner</span>
                    <span>IVR Keypad Navigation Built-In</span>
                  </div>
                </Link>

                {/* Card 4: Relay a Message */}
                <Link
                  href="/test-emergency"
                  className="group relative flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest border border-border-hairline shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="space-y-space-md">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg bg-surface-subtle flex items-center justify-center text-on-surface group-hover:bg-primary-subtle group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                        arrow_forward
                      </span>
                    </div>
                    <div>
                      <h3 className="font-card-title text-card-title text-on-surface group-hover:text-primary transition-colors">
                        Relay a Message
                      </h3>
                      <p className="font-body-base text-body-base text-on-surface-variant mt-1.5 leading-relaxed">
                        Urgent or standard spoken message transmission with optional verified GPS coordinates and vocal receipts.
                      </p>
                    </div>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-surface-container-low flex items-center gap-space-xs font-label-caps text-label-caps uppercase text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                    <span>GPS Geo-Stamp &amp; Delivery Log</span>
                  </div>
                </Link>

                {/* Card 5: Cancel a Service */}
                <Link
                  href="/templates?t=cancellation"
                  className="group relative flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest border border-border-hairline shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="space-y-space-md">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg bg-surface-subtle flex items-center justify-center text-on-surface group-hover:bg-error-bg group-hover:text-error transition-colors">
                        <span className="material-symbols-outlined text-[20px]">cancel_presentation</span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                        arrow_forward
                      </span>
                    </div>
                    <div>
                      <h3 className="font-card-title text-card-title text-on-surface group-hover:text-error transition-colors">
                        Cancel a Service
                      </h3>
                      <p className="font-body-base text-body-base text-on-surface-variant mt-1.5 leading-relaxed">
                        Navigates retention representatives, overrides discount loops, requests cancellations, and logs records.
                      </p>
                    </div>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-surface-container-low flex items-center gap-space-xs font-label-caps text-label-caps uppercase text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">gavel</span>
                    <span>Retention Defense Protocol</span>
                  </div>
                </Link>

                {/* Card 6: Elder Check-in */}
                <Link
                  href="/templates?t=elder_checkup"
                  className="group relative flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest border border-border-hairline shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="space-y-space-md">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg bg-surface-subtle flex items-center justify-center text-on-surface group-hover:bg-warning-bg group-hover:text-warning transition-colors">
                        <span className="material-symbols-outlined text-[20px]">favorite</span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                        arrow_forward
                      </span>
                    </div>
                    <div>
                      <h3 className="font-card-title text-card-title text-on-surface group-hover:text-primary transition-colors">
                        Elder Check-in
                      </h3>
                      <p className="font-body-base text-body-base text-on-surface-variant mt-1.5 leading-relaxed">
                        Warm, natural wellness check-in with elderly family members or loved ones, logging medication and comfort.
                      </p>
                    </div>
                  </div>
                  <div className="mt-space-lg pt-space-md border-t border-surface-container-low flex items-center gap-space-xs font-label-caps text-label-caps uppercase text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">sentiment_satisfied</span>
                    <span>Sentiment &amp; Wellness Summary</span>
                  </div>
                </Link>
              </div>
            </div>

            {/* How It Works / Explainer Callout (3-Step Pipeline) */}
            <div className="p-space-xl rounded-xl bg-surface-container-low border border-border-hairline shadow-2xs space-y-space-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                <div>
                  <span className="font-label-caps text-label-caps uppercase text-primary font-semibold">
                    Autonomous Architecture
                  </span>
                  <h3 className="font-section-header text-section-header text-on-surface mt-0.5">
                    How CALL-E Executes Calls On Your Behalf
                  </h3>
                </div>
                <span className="font-mono-code text-mono-code text-on-surface-variant">
                  Zero Training Required
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg relative">
                {/* Step 1 */}
                <div className="flex flex-col gap-space-sm p-4 rounded-lg bg-surface-container-lowest border border-border-hairline shadow-2xs">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-7 h-7 rounded-full bg-primary text-on-primary font-body-medium text-body-medium flex items-center justify-center font-semibold">
                      1
                    </div>
                    <span className="font-card-title text-card-title text-on-surface">
                      State Your Intent
                    </span>
                  </div>
                  <p className="font-body-base text-body-base text-on-surface-variant">
                    Type what you need in natural everyday language. Set boundary conditions, preferred appointment slots, or budget constraints.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col gap-space-sm p-4 rounded-lg bg-surface-container-lowest border border-border-hairline shadow-2xs">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-7 h-7 rounded-full bg-primary text-on-primary font-body-medium text-body-medium flex items-center justify-center font-semibold">
                      2
                    </div>
                    <span className="font-card-title text-card-title text-on-surface">
                      CALL-E Speaks Naturally
                    </span>
                  </div>
                  <p className="font-body-base text-body-base text-on-surface-variant">
                    Our dual-phase neural voice proxy initiates the telephony call, listens through interactive automated phone trees, and negotiates smoothly.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col gap-space-sm p-4 rounded-lg bg-surface-container-lowest border border-border-hairline shadow-2xs">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-7 h-7 rounded-full bg-primary text-on-primary font-body-medium text-body-medium flex items-center justify-center font-semibold">
                      3
                    </div>
                    <span className="font-card-title text-card-title text-on-surface">
                      Verified Evidence &amp; Logs
                    </span>
                  </div>
                  <p className="font-body-base text-body-base text-on-surface-variant">
                    Receive structured summary badges, cryptographic recording snippets, and an interactive confirmation code directly in your inbox.
                  </p>
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
              <span className="w-2 h-2 rounded-full bg-success" />
              Telephony Node Active
            </span>
            <span>© 2025 CALL-E Systems</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
