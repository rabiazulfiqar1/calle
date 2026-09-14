"use client";

import { useState } from "react";
import Nav from "@/app/components/Nav";
import PhoneInput from "@/app/components/PhoneInput";

type Vendor = {
  businessName: string;
  phone: string;
  region: string;
  locale: string;
};

type Phase = "compose" | "calling" | "result";

function emptyVendor(): Vendor {
  return { businessName: "", phone: "+92", region: "PK", locale: "en" };
}

export default function VendorComparisonPage() {
  const [service, setService] = useState("");
  const [preferredTiming, setPreferredTiming] = useState("");
  const [fieldsToAsk, setFieldsToAsk] = useState<string[]>(["Price", "Availability"]);
  const [vendors, setVendors] = useState<Vendor[]>([emptyVendor(), emptyVendor()]);

  const [phase, setPhase] = useState<Phase>("compose");
  const [error, setError] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | undefined>();
  const [callId, setCallId] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  function updateField(i: number, value: string) {
    setFieldsToAsk((f) => f.map((v, idx) => (idx === i ? value : v)));
  }
  function addField() {
    setFieldsToAsk((f) => [...f, ""]);
  }
  function removeField(i: number) {
    setFieldsToAsk((f) => f.filter((_, idx) => idx !== i));
  }

  function updateVendor(i: number, patch: Partial<Vendor>) {
    setVendors((v) => v.map((vendor, idx) => (idx === i ? { ...vendor, ...patch } : vendor)));
  }
  function addVendor() {
    setVendors((v) => [...v, emptyVendor()]);
  }
  function removeVendor(i: number) {
    setVendors((v) => v.filter((_, idx) => idx !== i));
  }

  const canSubmit =
    service.trim().length > 0 &&
    fieldsToAsk.filter((f) => f.trim()).length > 0 &&
    vendors.length >= 2 &&
    vendors.every((v) => v.businessName.trim() && v.phone.trim());

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: "vendor_comparison",
          details: {
            service,
            preferredTiming: preferredTiming || undefined,
            fieldsToAsk: fieldsToAsk.filter((f) => f.trim()),
            vendors: vendors.map((v) => ({
              businessName: v.businessName,
              contact: { phone: v.phone, region: v.region, locale: v.locale },
            })),
          },
        }),
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        setError(`Unexpected response (${res.status}). Please try again.`);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error?.formErrors?.join(", ") ?? data.error ?? "Could not start comparison.");
        setSubmitting(false);
        return;
      }

      if (typeof data.quotaRemaining === "number") setQuotaRemaining(data.quotaRemaining);
      setCallId(data.callId);
      setPhase("calling");
      pollStatus(data.callId);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  async function pollStatus(id: string) {
    const POLL_INTERVAL_MS = 5000;
    const MAX_ATTEMPTS = 96; // ~8 minutes

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const res = await fetch(`/api/calle/call-status?id=${id}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Could not check status.");
          setSubmitting(false);
          return;
        }
        if (data.status === "completed") {
          setResult(data.result);
          setPhase("result");
          setSubmitting(false);
          return;
        }
        if (data.status === "failed") {
          setError(data.error ?? "The comparison calls failed.");
          setSubmitting(false);
          return;
        }
      } catch {
        continue;
      }
    }

    setTimedOut(true);
    setSubmitting(false);
  }

  function startOver() {
    setService("");
    setPreferredTiming("");
    setFieldsToAsk(["Price", "Availability"]);
    setVendors([emptyVendor(), emptyVendor()]);
    setPhase("compose");
    setError(null);
    setCallId(null);
    setResult(null);
    setTimedOut(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface font-body-base text-on-surface antialiased">
      <Nav />
      <main className="w-full pt-16 bg-surface min-h-screen">
        <div className="max-w-4xl mx-auto w-full px-margin py-space-xl flex flex-col gap-space-xl">
          {/* Header Card */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-sm">
              <h1 className="font-page-header text-page-header text-on-surface tracking-tight">
                Compare Vendors
              </h1>
              <span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps uppercase bg-primary-subtle text-primary font-semibold">
                Parallel Dialing
              </span>
            </div>
            <p className="font-body-base text-body-base text-on-surface-variant">
              CALL-E calls each vendor in parallel, asks the same questions, and picks the best fit.
            </p>
          </div>

          {phase === "compose" && (
            <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-border-hairline p-space-xl flex flex-col gap-space-xl">
              {/* Step 01: Job Description */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                  01. What job do you need done?
                </label>
                <textarea
                  rows={3}
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="e.g. Fixing a leaking kitchen faucet"
                  className="w-full bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none focus:bg-surface-container-lowest resize-y"
                />
              </div>

              {/* Step 02: Preferred Timing */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                  02. Preferred timing (optional)
                </label>
                <input
                  type="text"
                  value={preferredTiming}
                  onChange={(e) => setPreferredTiming(e.target.value)}
                  placeholder="e.g. This week, weekday afternoons"
                  className="w-full bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline shadow-xs focus:outline-none focus:bg-surface-container-lowest"
                />
              </div>

              {/* Step 03: Questions to Ask */}
              <div className="flex flex-col gap-space-sm">
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                  03. What should CALL-E ask every vendor?
                </label>
                {fieldsToAsk.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={f}
                      onChange={(e) => updateField(i, e.target.value)}
                      placeholder="e.g. Price"
                      className="flex-1 bg-surface-subtle rounded-lg px-3.5 py-2.5 font-body-base text-body-base text-on-surface border border-border-hairline focus:outline-none focus:bg-surface-container-lowest"
                    />
                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      disabled={fieldsToAsk.length <= 1}
                      className="px-3 rounded-lg border border-border-hairline text-on-surface-variant hover:text-error disabled:opacity-40 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addField}
                  className="self-start text-sm font-medium text-primary hover:text-brand-mark-blue flex items-center gap-1 pt-1"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add a question
                </button>
              </div>

              {/* Step 04: Vendors List */}
              <div className="flex flex-col gap-space-md">
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                  04. Vendors to call (at least 2)
                </label>
                {vendors.map((v, i) => (
                  <div
                    key={i}
                    className="p-space-base rounded-xl border border-border-hairline bg-surface-subtle flex flex-col gap-space-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-card-title text-card-title text-on-surface">
                        Vendor {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeVendor(i)}
                        disabled={vendors.length <= 2}
                        className="text-on-surface-variant hover:text-error disabled:opacity-40 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={v.businessName}
                      onChange={(e) => updateVendor(i, { businessName: e.target.value })}
                      placeholder="Business name"
                      className="w-full bg-surface-container-lowest rounded-lg px-3.5 py-2.5 font-body-base text-body-base border border-border-hairline focus:outline-none"
                    />
                    <PhoneInput
                      phone={v.phone}
                      region={v.region}
                      onChange={(p, r) => updateVendor(i, { phone: p, region: r })}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVendor}
                  className="self-start text-sm font-medium text-primary hover:text-brand-mark-blue flex items-center gap-1 pt-1"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add another vendor
                </button>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-sm text-error-text flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Voice Sandbox & Acoustic Engine Micro-Card (Positioned above submit button) */}
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

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="self-end px-6 py-3 rounded-lg bg-surface-dark text-canvas-white font-body-medium text-body-medium font-semibold hover:bg-surface-dark-elevated transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] text-warning animate-spin">
                      progress_activity
                    </span>
                    <span>Calling Vendors...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px] text-electric-sky animate-pulse">
                      call_split
                    </span>
                    <span>Call All Vendors</span>
                  </>
                )}
              </button>
            </section>
          )}

          {phase === "calling" && (
            <section className="bg-surface-container-lowest rounded-xl shadow-md border border-border-hairline p-space-xl flex flex-col items-center justify-center text-center gap-space-lg py-16">
              <div className="w-16 h-16 rounded-2xl bg-primary-subtle border border-primary-glow flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-primary animate-pulse">
                  call_split
                </span>
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <h2 className="font-section-header text-section-header text-on-surface">
                  {timedOut ? "Still checking…" : `Calling ${vendors.length} vendors`}
                </h2>
                <p className="font-body-base text-body-base text-on-surface-variant">
                  {timedOut
                    ? "This is taking longer than expected — you can check status again below."
                    : "CALL-E is speaking with each vendor in parallel and will compare their answers once every call completes."}
                </p>
              </div>
              {timedOut && callId && (
                <button
                  type="button"
                  onClick={() => {
                    setTimedOut(false);
                    setSubmitting(true);
                    pollStatus(callId);
                  }}
                  className="text-sm font-medium text-primary hover:text-brand-mark-blue flex items-center gap-1.5 pt-2"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  Check status again →
                </button>
              )}
              {error && (
                <div className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-sm text-error-text">
                  {error}
                </div>
              )}
            </section>
          )}

          {phase === "result" && result && (
            <section className="flex flex-col gap-space-lg">
              <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-border-hairline p-space-xl flex flex-col gap-space-sm">
                <span className="font-label-caps text-label-caps uppercase text-primary font-semibold">
                  Recommended Option
                </span>
                <h2 className="font-section-header text-section-header text-on-surface">
                  {result.comparison?.winner ?? "No clear winner"}
                </h2>
                <p className="font-body-base text-body-base text-on-surface-variant">
                  {result.comparison?.reasoning}
                </p>
                {typeof quotaRemaining === "number" && (
                  <p className="font-body-meta text-body-meta text-on-surface-variant">
                    {quotaRemaining} calls left today
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-base">
                {(result.recipients ?? []).map((r: any, i: number) => {
                  const sr = r.structuredResult ?? {};
                  const isWinner =
                    result.comparison?.winner && result.comparison.winner === vendors[i]?.businessName;
                  return (
                    <div
                      key={i}
                      className={`p-space-base rounded-xl border shadow-xs flex flex-col gap-space-sm ${
                        isWinner
                          ? "border-primary bg-primary-subtle"
                          : "border-border-hairline bg-surface-container-lowest"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-card-title text-card-title text-on-surface">
                          {vendors[i]?.businessName ?? `Vendor ${i + 1}`}
                        </span>
                        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                          {sr.outcome}
                        </span>
                      </div>
                      {fieldsToAsk
                        .filter((f) => f.trim())
                        .map((label, fi) => (
                          <p key={fi} className="font-body-base text-body-base text-on-surface-variant">
                            <span className="font-medium text-on-surface">{label}:</span>{" "}
                            {sr[`field_${fi}`] ?? "not provided"}
                          </p>
                        ))}
                      {sr.notes && (
                        <p className="font-body-meta text-body-meta text-on-surface-variant italic">
                          {sr.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={startOver}
                className="self-start text-sm text-on-surface-variant hover:text-on-surface underline underline-offset-2 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Compare a new set of vendors
              </button>
            </section>
          )}


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