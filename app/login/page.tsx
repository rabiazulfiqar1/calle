"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
        setMode("login");
      }
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700"
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingDots />
            {mode === "login" ? "Signing in…" : "Creating account…"}
          </span>
        ) : mode === "login" ? (
          "Sign in"
        ) : (
          "Create account"
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
          setMessage(null);
        }}
        className="text-sm text-center text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <span className="font-medium text-blue-600">Sign up</span>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <span className="font-medium text-blue-600">Sign in</span>
          </>
        )}
      </button>
    </form>
  );
}

function LoadingDots() {
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-white animate-bounce"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </span>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-zinc-950 text-white p-12">
        <div className="flex items-center gap-2.5">
          <CalleLogoWhite />
          <span className="font-semibold text-lg tracking-tight">CALL-E</span>
        </div>

        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight mb-6">
            Your voice
            <br />
            when you need it.
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed max-w-sm">
            CALL-E makes phone calls on your behalf. Book appointments, check on
            orders, relay messages — without speaking a word.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {[
              { label: "Book appointments", desc: "Clinics, salons, offices — CALL-E handles it." },
              { label: "Check order status", desc: "Know exactly where your delivery is." },
              { label: "Relay messages", desc: "Let someone know you're thinking of them." },
            ].map((f) => (
              <div key={f.label} className="flex gap-3 items-start">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">{f.label}</p>
                  <p className="text-sm text-zinc-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-600">
          Designed for Deaf and mute users. Every call placed with care.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <CalleLogoBlue />
          <span className="font-semibold text-lg tracking-tight text-zinc-900">CALL-E</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">
              Sign in to CALL-E
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              New to CALL-E? You can create an account below.
            </p>
          </div>

          <Suspense fallback={<div className="h-60 rounded-xl bg-zinc-50 animate-pulse" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function CalleLogoWhite() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="#0055ff" />
      <path d="M8 14a6 6 0 1 0 12 0 6 6 0 0 0-12 0Z" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M18 19l3 3" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CalleLogoBlue() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="#0055ff" />
      <path d="M8 14a6 6 0 1 0 12 0 6 6 0 0 0-12 0Z" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M18 19l3 3" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}