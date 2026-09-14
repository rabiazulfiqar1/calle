"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CalendarDays,
  Sparkles,
  Scale,
  Truck,
  AudioLines,
  Phone,
  CircleCheck,
} from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);

  function clearNotices() {
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    clearNotices();

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
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
        setMode("login");
      }
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then tap \u201CForgot password?\u201D");
      return;
    }
    clearNotices();
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Password reset link sent — check your inbox.");
    }
  }

  async function handleGoogle() {
    clearNotices();
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${redirectTo}` },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Icon mark */}
      <div className="h-11 w-11 rounded-xl bg-primary-subtle/10 border border-border-hairline flex items-center justify-center text-primary mb-6">
        <Phone className="w-5 h-5" />
      </div>

      <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider">
        {mode === "login" ? "Welcome back" : "Get started"}
      </span>
      <h2 className="mt-1.5 font-page-header text-page-header text-on-surface tracking-tight">
        {mode === "login" ? "Good to hear from you." : "Let's set up CALL-E."}
      </h2>
      <p className="mt-2 font-body-base text-body-base text-on-surface-variant">
        {mode === "login"
          ? "Sign in to manage your voice proxy calls."
          : "One account is all it takes to start placing calls on your behalf."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-space-lg">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="font-body-medium text-body-medium text-on-surface font-semibold">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-[18px] h-[18px]" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-border-hairline bg-surface-subtle text-on-surface font-body-base text-body-base placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40 transition-colors"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="font-body-medium text-body-medium text-on-surface font-semibold">
              Password
            </label>
            {mode === "login" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="font-body-meta text-body-meta text-primary hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-[18px] h-[18px]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border-hairline bg-surface-subtle text-on-surface font-body-base text-body-base placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40 transition-colors"
              placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="Toggle password visibility"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none"
            >
              {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>

        {mode === "login" && (
          <label className="flex items-center gap-2 -mt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              className="h-4 w-4 rounded border-border-hairline text-primary focus:ring-primary/40 accent-primary"
            />
            <span className="font-body-meta text-body-meta text-on-surface-variant">Keep me signed in</span>
          </label>
        )}

        {error && (
          <div
            role="alert"
            className="px-3.5 py-2.5 rounded-lg bg-error-bg border border-error-border font-body-meta text-body-meta text-error-text flex items-center gap-2"
          >
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="px-3.5 py-2.5 rounded-lg bg-success-bg border border-success-border font-body-meta text-body-meta text-success-text flex items-center gap-2"
          >
            <CircleCheck className="w-[18px] h-[18px]" />
            <span>{message}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-3 px-4 rounded-lg bg-surface-dark text-canvas-white font-body-medium text-body-medium font-semibold hover:bg-surface-dark-elevated focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <LoadingDots />
              <span>{mode === "login" ? "Signing in\u2026" : "Creating account\u2026"}</span>
            </>
          ) : (
            <>
              <span>{mode === "login" ? "Sign in" : "Create account"}</span>
              <ArrowRight className="w-[18px] h-[18px]" />
            </>
          )}
        </button>

        <p className="font-body-meta text-body-meta text-center text-on-surface-variant">
          {mode === "login" ? (
            <>
              New to CALL-E?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  clearNotices();
                }}
                className="font-semibold text-primary hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  clearNotices();
                }}
                className="font-semibold text-primary hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </form>

    </div>
  );
}

function LoadingDots() {
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-canvas-white"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </span>
  );
}

const FEATURES = [
  { Icon: CalendarDays, label: "Book Slots", desc: "Clinics & Salons" },
  { Icon: Sparkles, label: "Custom Agentic Call", desc: "Any goal, planned & approved" },
  { Icon: Scale, label: "Compare Vendors", desc: "Parallel call, AI pick" },
  { Icon: Truck, label: "Track Orders", desc: "IVR menu bypass" },
];

const EQ_HEIGHTS = [8, 16, 24, 12, 20, 28, 16, 32, 20, 12, 24, 8, 20, 28, 16, 12, 24, 16, 8, 20];

export default function LoginPage() {
  return (
    <div className="min-h-screen flex font-body-base antialiased">
      {/* Left panel — brand + mascot + capability strip */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-surface-dark text-canvas-white p-12 relative overflow-hidden">
        {/* Faint grid backdrop */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-canvas-white, #fff) 1px, transparent 1px), linear-gradient(to bottom, var(--color-canvas-white, #fff) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-primary-container/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 w-64 h-64 rounded-full bg-electric-sky/10 blur-3xl pointer-events-none" />

        {/* Brand row */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-space-sm">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-xs">
              <Phone className="w-[18px] h-[18px]" />
            </div>
            <span className="font-section-header text-section-header tracking-tight">CALL-E</span>
          </div>
          <div className="hidden xl:flex items-center gap-space-xs px-2.5 py-1 rounded-full bg-surface-dark-elevated border border-surface-dark-border font-mono-code text-mono-code text-electric-sky">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-success"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span>Node US-EAST-04 · Operational</span>
          </div>
        </div>

        {/* Headline + mascot */}
        <div className="relative z-10 flex flex-col gap-space-lg my-4">
          <div className="flex items-center gap-space-xs text-electric-sky">
            <Sparkles className="w-4 h-4" />
            <span className="font-label-caps text-label-caps uppercase tracking-wider">Your voice, delegated</span>
          </div>

          <h1 className="font-page-header text-page-header leading-tight tracking-tight max-w-sm">
            Your voice
            <br />
            <span className="text-electric-sky">when you need it.</span>
          </h1>
          <p className="font-body-base text-body-base text-surface-variant leading-relaxed max-w-sm">
            CALL-E makes real phone calls on your behalf. Book appointments,
            run a custom agentic call, compare vendors, or relay a message —
            without speaking a word.
          </p>

          <div className="self-center">
            <VoiceMascot />
          </div>
        </div>

        {/* Acoustic equalizer strip */}
        <div className="relative z-10 p-3.5 rounded-xl bg-surface-dark-elevated border border-surface-dark-border shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-xs">
              <AudioLines className="text-electric-sky w-[16px] h-[16px]" />
              <span className="font-label-caps text-label-caps text-surface-variant uppercase tracking-wider">
                Acoustic Synthesizer
              </span>
            </div>
            <span className="font-mono-code text-[11px] text-success">99.4% Verified</span>
          </div>
          <div className="h-9 bg-surface-dark rounded-lg px-3 flex items-end justify-between gap-1 overflow-hidden">
            {EQ_HEIGHTS.map((h, i) => (
              <motion.div
                key={i}
                className="w-1 bg-electric-sky rounded-full"
                style={{ height: `${h}px` }}
                animate={{ opacity: [1, 0.4, 1], scaleY: [1, 1.3, 1] }}
                transition={{ duration: 0.6 + (i % 6) * 0.15, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </div>
        </div>

        {/* Capability badge grid */}
        <div className="relative z-10 grid grid-cols-2 gap-space-sm mt-space-base">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="p-2.5 rounded-xl bg-surface-dark-elevated border border-surface-dark-border flex items-center gap-space-sm"
            >
              <f.Icon className="text-canvas-white w-5 h-5" />
              <div className="flex flex-col">
                <span className="font-card-title text-[12px] font-bold text-canvas-white leading-tight">
                  {f.label}
                </span>
                <span className="font-mono-code text-[10px] text-surface-variant">{f.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="font-body-meta text-body-meta text-surface-variant relative z-10 mt-space-lg text-center">
          Designed for Deaf and speech-impaired users. Every call placed with care.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-surface">
        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-space-sm mb-10 self-start ml-[max(1.5rem,calc(50%-12rem))]">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-xs">
            <Phone className="w-[18px] h-[18px]" />
          </div>
          <span className="font-section-header text-section-header text-on-surface tracking-tight">
            CALL-E
          </span>
        </div>

        <Suspense
          fallback={<div className="h-96 w-full max-w-sm rounded-xl bg-surface-container-lowest border border-border-hairline animate-pulse" />}
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

// ── Mascot: cute yellow speech-bubble face with a lucide Phone icon,
// animated entirely with framer-motion (float, blink, swing, waves) ──

function VoiceMascot() {
  return (
    <div className="relative">
      {/* Breathing glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-warning/25 via-primary/15 to-electric-sky/20 blur-2xl pointer-events-none"
        animate={{ opacity: [0.55, 0.85, 0.55], scale: [1.2, 1.35, 1.2] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating bubble */}
      <motion.svg
        className="w-24 h-24 sm:w-28 sm:h-28 relative z-10 drop-shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
        fill="none"
        viewBox="0 0 160 160"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ y: [0, -8, 0], rotate: [-1.5, 1.5, -1.5] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <radialGradient cx="38%" cy="30%" id="mascotBubble" r="75%">
            <stop offset="0%" stopColor="#fff6d8" />
            <stop offset="45%" stopColor="#ffd43b" />
            <stop offset="100%" stopColor="#ffa94d" />
          </radialGradient>
        </defs>

        <path
          d="M80 26
             C112 26, 138 49, 138 78
             C138 107, 112 130, 80 130
             C71 130, 63 128.5, 56 126
             C50 133, 40 138, 30 139
             C34 130, 36 122, 35 115
             C26 105, 22 92, 22 78
             C22 49, 48 26, 80 26 Z"
          fill="url(#mascotBubble)"
          stroke="#e8890c"
          strokeWidth="2"
        />

        <ellipse cx="62" cy="52" fill="#ffffff" fillOpacity="0.35" rx="18" ry="9" transform="rotate(-20 62 52)" />

        {/* Quick-blinking eyes */}
        <motion.path
          d="M56 72 C60 66, 68 66, 72 72"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeWidth="5"
          fill="none"
          style={{ transformOrigin: "64px 69px" }}
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 2, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}
        />
        <motion.path
          d="M92 72 C96 66, 104 66, 108 72"
          stroke="#1a1a1a"
          strokeLinecap="round"
          strokeWidth="5"
          fill="none"
          style={{ transformOrigin: "100px 69px" }}
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 2, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1], delay: 0.05 }}
        />

        {/* Rosy cheeks */}
        <circle cx="52" cy="94" r="6" fill="#ff922b" fillOpacity="0.35" />
        <circle cx="108" cy="94" r="6" fill="#ff922b" fillOpacity="0.35" />

        {/* Smile */}
        <path d="M58 90 C66 104, 98 104, 106 90" fill="none" stroke="#1a1a1a" strokeLinecap="round" strokeWidth="5" />

        {/* Sound waves */}
        <motion.path
          d="M128 58 C136 68 136 84 128 94"
          stroke="var(--color-electric-sky, #38bdf8)"
          strokeDasharray="3 3"
          strokeLinecap="round"
          strokeWidth="3"
          fill="none"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.05, 0.9] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M136 50 C148 66 148 96 136 108"
          stroke="var(--color-electric-sky, #38bdf8)"
          strokeLinecap="round"
          strokeWidth="2.5"
          fill="none"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.05, 0.9] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
        />
      </motion.svg>

      {/* Lucide phone icon, swinging, positioned over the bubble's lower-left */}
      <motion.div
        className="absolute bottom-2 left-0 z-20 text-[#1a1a1a]"
        style={{ transformOrigin: "top left" }}
        animate={{ rotate: [-18, -24, -18] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Phone className="w-6 h-6 fill-[#1a1a1a]" strokeWidth={1.5} />
      </motion.div>
    </div>
  );
}