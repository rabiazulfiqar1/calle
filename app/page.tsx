"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/app/components/Nav";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  {
    href: "/templates",
    icon: CalendarIcon,
    title: "Book an Appointment",
    description: "Schedule clinics, salons, offices — CALL-E calls and confirms.",
    badge: null,
  },
  {
    href: "/call",
    icon: SparkleIcon,
    title: "Custom Call",
    description: "Describe what you need in plain language. CALL-E handles the rest.",
    badge: "Flexible",
  },
  {
    href: "/templates?t=order_status",
    icon: PackageIcon,
    title: "Check Order Status",
    description: "Find out exactly where your delivery is and when it arrives.",
    badge: null,
  },
  {
    href: "/test-emergency",
    icon: MessageIcon,
    title: "Relay a Message",
    description: "Let someone know you're okay, where you are, or need them.",
    badge: null,
  },
  {
    href: "/templates?t=cancellation",
    icon: XCircleIcon,
    title: "Cancel a Service",
    description: "Cancel subscriptions, bookings, or accounts — firmly and politely.",
    badge: null,
  },
  {
    href: "/templates?t=elder_checkup",
    icon: HeartIcon,
    title: "Elder Check-in",
    description: "Have CALL-E check in on a loved one with a warm, natural conversation.",
    badge: null,
  },
];

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email ?? null;
      setEmail(userEmail);
      if (userEmail) {
        setFirstName(userEmail.split("@")[0]);
      }
    });
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Nav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-1 text-zinc-500 text-base">
            What would you like CALL-E to do for you?
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.href} {...f} />
          ))}
        </div>

        {/* Info callout */}
        <div className="mt-12 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-5 flex gap-4 items-start">
          <InfoIcon />
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">How CALL-E works</h2>
            <p className="mt-1 text-sm text-zinc-500 leading-relaxed max-w-lg">
              You describe what you need. CALL-E places a real phone call to the number you provide,
              speaks on your behalf, and reports back exactly what happened — word for word.
              You stay in control at every step.
            </p>
            <div className="mt-3 flex gap-6">
              <Stat label="Templates" value="5" />
              <Stat label="Daily calls" value="5" />
              <Stat label="Languages" value="EN / UR" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
}: (typeof FEATURES)[0]) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
          <Icon />
        </div>
        {badge && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
            {badge}
          </span>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-zinc-900 text-sm">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium text-blue-600 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
        Get started
        <ArrowRightIcon />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-base font-semibold text-zinc-800">{value}</p>
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="14" height="12" rx="2" stroke="#0055ff" strokeWidth="1.25" />
      <path d="M2 7.5h14" stroke="#0055ff" strokeWidth="1.25" />
      <path d="M6 2v3M12 2v3" stroke="#0055ff" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M5.5 11h2M10.5 11h2M5.5 13.5h2" stroke="#0055ff" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 2v3M9 13v3M2 9h3M13 9h3M4.05 4.05l2.12 2.12M11.83 11.83l2.12 2.12M4.05 13.95l2.12-2.12M11.83 6.17l2.12-2.12" stroke="#0055ff" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2 5.5l7-3.5 7 3.5v7L9 16l-7-3.5v-7Z" stroke="#0055ff" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M9 2v14M2 5.5l7 3.5 7-3.5" stroke="#0055ff" strokeWidth="1.25" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 3.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2.5V4.5a1 1 0 0 1 1-1Z" stroke="#0055ff" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M6 7.5h6M6 10h4" stroke="#0055ff" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7" stroke="#0055ff" strokeWidth="1.25" />
      <path d="M6.5 6.5l5 5M11.5 6.5l-5 5" stroke="#0055ff" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 14.5S2.5 10.5 2.5 6.25a3.75 3.75 0 0 1 6.5-2.55A3.75 3.75 0 0 1 15.5 6.25C15.5 10.5 9 14.5 9 14.5Z" stroke="#0055ff" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
      <circle cx="9" cy="9" r="7.5" stroke="#a1a1aa" strokeWidth="1.25" />
      <path d="M9 8v5M9 6v.5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
