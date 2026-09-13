"use client";

// ── Country data ──────────────────────────────────────────────────────────
// Sorted by dialCode length descending to avoid prefix-conflict bugs
// (e.g. "+1" matching "+91" or "+971" prematurely).

export const COUNTRIES = [
  { region: "AE", dialCode: "+971", flag: "🇦🇪", name: "UAE" },
  { region: "PK", dialCode: "+92", flag: "🇵🇰", name: "Pakistan" },
  { region: "IN", dialCode: "+91", flag: "🇮🇳", name: "India" },
  { region: "GB", dialCode: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { region: "US", dialCode: "+1", flag: "🇺🇸", name: "United States" },
] as const;

export type CountryRegion = (typeof COUNTRIES)[number]["region"];

/** Find a country entry by region code (falls back to PK). */
export function findCountryByRegion(region: string) {
  return COUNTRIES.find((c) => c.region === region) ?? COUNTRIES[1]; // PK
}

/**
 * Split an E.164 phone string into { dialCode, localNumber }.
 * e.g. "+923001234567" → { dialCode: "+92", localNumber: "3001234567" }
 * e.g. "+92"           → { dialCode: "+92", localNumber: "" }
 */
export function parseE164(phone: string) {
  for (const c of COUNTRIES) {
    if (phone.startsWith(c.dialCode)) {
      return { dialCode: c.dialCode, localNumber: phone.slice(c.dialCode.length) };
    }
  }
  return { dialCode: "+92", localNumber: "" };
}

// ── Component ─────────────────────────────────────────────────────────────

interface PhoneInputProps {
  /** Full E.164 phone string — e.g. "+923001234567" */
  phone: string;
  /** ISO region code — e.g. "PK" */
  region: string;
  /** Called whenever either field changes. Parent must update both. */
  onChange: (phone: string, region: string) => void;
  /** id for the number <input> (for label association) */
  id?: string;
  required?: boolean;
}

export default function PhoneInput({
  phone,
  region,
  onChange,
  id = "phone",
  required,
}: PhoneInputProps) {
  const country = findCountryByRegion(region);
  // Derive localNumber from the full phone prop
  const { localNumber } = parseE164(phone);

  function handleCountryChange(newRegion: string) {
    const newCountry = findCountryByRegion(newRegion);
    onChange(newCountry.dialCode + localNumber, newRegion);
  }

  function handleNumberChange(raw: string) {
    // Allow only digits in the local-number field
    const digits = raw.replace(/\D/g, "");
    onChange(country.dialCode + digits, region);
  }

  return (
    <div className="flex rounded-lg border border-zinc-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-shadow">
      {/* ── Country-code selector ── */}
      <div className="relative shrink-0 border-r border-zinc-200">
        {/*
          The <select> sits on top (opacity-0) so the browser handles
          keyboard navigation and accessibility. The styled div below
          shows the current selection visually.
        */}
        <select
          value={region}
          onChange={(e) => handleCountryChange(e.target.value)}
          aria-label="Country code"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        >
          {COUNTRIES.map((c) => (
            <option key={c.region} value={c.region}>
              {c.flag}  {c.dialCode}  —  {c.name}
            </option>
          ))}
        </select>

        {/* Visual layer */}
        <div className="pointer-events-none flex items-center gap-1.5 px-3 h-full bg-zinc-50 min-w-[90px]">
          <span className="text-base leading-none" aria-hidden="true">
            {country.flag}
          </span>
          <span className="text-sm font-medium text-zinc-700 tabular-nums">
            {country.dialCode}
          </span>
          <ChevronDown />
        </div>
      </div>

      {/* ── Local number input ── */}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        value={localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        required={required}
        placeholder="3001234567"
        aria-label="Phone number"
        className="flex-1 min-w-0 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 bg-white focus:outline-none"
      />
    </div>
  );
}

// ── Icon ──────────────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="text-zinc-400"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

