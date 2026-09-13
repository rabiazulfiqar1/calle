"use client";

import { useState } from "react";
import Nav from "@/app/components/Nav";
import StatusBadge from "@/app/components/StatusBadge";
import CallResult from "@/app/components/CallResult";
import PhoneInput from "@/app/components/PhoneInput";

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

type CallStatus = "idle" | "locating" | "calling" | "success" | "error";

export default function RelayPage() {
  const [phone, setPhone] = useState("+92");
  const [region, setRegion] = useState("PK");
  const [locale, setLocale] = useState("en");
  const [contactName, setContactName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [messageToRelay, setMessageToRelay] = useState("");
  const [userName, setUserName] = useState("");
  const [shareLocation, setShareLocation] = useState(false);
  const [location, setLocation] = useState("");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | undefined>();

  async function captureLocation() {
    setCallStatus("locating");
    setError(null);
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const data = await res.json();
            setLocation(data.display_name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          } catch {
            setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          }
          setCallStatus("idle");
          resolve();
        },
        (err) => {
          setError(`Location error: ${err.message}`);
          setCallStatus("idle");
          resolve();
        }
      );
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCallStatus("calling");
    setError(null);
    setResult(null);

    const body = {
      templateId: "relay_message",
      recipient: { phone, region, locale },
      user: userName ? { name: userName } : {},
      details: {
        contactName,
        relationship: relationship || undefined,
        messageToRelay: messageToRelay || "Checking in.",
        location: shareLocation && location ? location : undefined,
        locationConsent: shareLocation,
      },
    };

    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setResult(data.result);
      if (typeof data.quotaRemaining === "number") setQuotaRemaining(data.quotaRemaining);
      setCallStatus("success");
    } catch (err) {
      setError(String(err));
      setCallStatus("error");
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setCallStatus("idle");
    setContactName("");
    setRelationship("");
    setMessageToRelay("");
    setShareLocation(false);
    setLocation("");
  }

  const isCalling = callStatus === "calling";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Nav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Relay a Message</h1>
            <p className="mt-1 text-sm text-zinc-500">
              CALL-E calls someone and delivers your message on your behalf.
            </p>
          </div>
          <StatusBadge
            status={isCalling ? "calling" : callStatus === "success" ? "success" : callStatus === "error" ? "error" : "idle"}
          />
        </div>

        {callStatus === "success" && result ? (
          /* ── Result view ── */
          <div className="flex flex-col gap-4">
            <CallResult result={result} templateId="relay_message" quotaRemaining={quotaRemaining} />
            <button
              onClick={reset}
              className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2 text-left"
            >
              ← Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* ── Recipient ── */}
            <Section title="Who to call" desc="The person CALL-E will reach.">
              <div className="flex flex-col gap-4">
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
                    required
                  />
                </div>
                <div className="w-full sm:w-48">
                  <FieldLabel htmlFor="locale" label="Language" required />
                  <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value)} className={inputCls}>
                    {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            </Section>

            {/* ── Message details ── */}
            <Section title="The message" desc="What CALL-E will say.">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="contactName" label="Who are we calling?" required />
                    <input
                      id="contactName"
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      required
                      placeholder="e.g. Ahmed, Mom, Dr. Khan"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="relationship" label="Your relationship to them" />
                    <input
                      id="relationship"
                      type="text"
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      placeholder="e.g. friend, colleague, mother"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor="messageToRelay" label="What should CALL-E say?" required />
                  <textarea
                    id="messageToRelay"
                    rows={4}
                    value={messageToRelay}
                    onChange={(e) => setMessageToRelay(e.target.value)}
                    required
                    placeholder="e.g. I'm running 20 minutes late. I'm on my way and will be there soon."
                    className={`${inputCls} resize-y`}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="userName" label="Your name (optional)" hint="CALL-E says 'on behalf of…'" />
                  <input
                    id="userName"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Rabia"
                    className={inputCls}
                  />
                </div>
              </div>
            </Section>

            {/* ── Location ── */}
            <Section title="Share your location" desc="Optional — only if it's relevant to the message.">
              <div className="flex flex-col gap-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="shareLocation"
                    checked={shareLocation}
                    onChange={(e) => setShareLocation(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-zinc-700">Include my location in the message</span>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      CALL-E will share your address once, clearly, and offer to repeat it.
                    </p>
                  </div>
                </label>

                {shareLocation && (
                  <div className="flex flex-col gap-3 pl-7">
                    {location ? (
                      <div className="px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800 flex items-start gap-2">
                        <CheckCircleIcon />
                        <span>{location}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={captureLocation}
                        disabled={callStatus === "locating"}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <LocateIcon />
                        {callStatus === "locating" ? "Getting location…" : "Capture my current location"}
                      </button>
                    )}
                    <div>
                      <FieldLabel htmlFor="location" label="Or type your location" />
                      <input
                        id="location"
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Outside City Hospital, Main Gate"
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* ── Error ── */}
            {error && (
              <div role="alert" className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* ── Submit ── */}
            <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                type="submit"
                disabled={isCalling || !phone || !contactName}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCalling ? (
                  <><LoadingDots />&nbsp;CALL-E is calling…</>
                ) : (
                  <><PhoneIcon />&nbsp;Send Message via CALL-E</>
                )}
              </button>
              {isCalling && (
                <p className="text-xs text-zinc-400">
                  Please wait. This usually takes 1–3 minutes.
                </p>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
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
        {!required && <span className="ml-1 text-zinc-400 font-normal text-xs">(optional)</span>}
      </label>
      {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

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

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="#16a34a" strokeWidth="1.25" />
      <path d="M5 8l2.5 2.5L11 6" stroke="#16a34a" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LocateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}