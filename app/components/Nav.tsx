"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/templates", label: "Templates" },
  { href: "/call", label: "Custom Call" },
  { href: "/test-emergency", label: "Relay Message" },
  { href: "/demo", label: "Demo" },
];

export default function Nav() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quotaRemaining, setQuotaRemaining] = useState<number>(5);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="fixed top-0 w-full z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-border-hairline">
      <div className="h-16 max-w-6xl mx-auto px-margin flex items-center justify-between gap-space-xl">
        {/* Left: Brand */}
        <Link href="/" className="flex items-center gap-space-sm shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-xs">
            <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
          </div>
          <span className="font-section-header text-section-header text-on-surface tracking-tight">
            Your Voice
          </span>
        </Link>

        {/* Center: Desktop Nav — plain links, underline for active state */}
        <nav className="hidden md:flex items-center gap-space-lg">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-1 font-body-medium text-body-medium transition-colors ${
                  active ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute -bottom-[19px] left-0 right-0 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Quota & User */}
        <div className="flex items-center gap-space-lg shrink-0">
          {/* Daily Quota — simple text + dot, no cramped bar */}
          <div className="hidden lg:flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                quotaRemaining > 0 ? "bg-success" : "bg-error"
              }`}
            />
            <span className="font-body-meta text-body-meta text-on-surface-variant whitespace-nowrap">
              {quotaRemaining}/5 calls left today
            </span>
          </div>

          {/* User */}
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                person
              </span>
            </div>
            <span className="hidden sm:inline font-body-meta text-body-meta text-on-surface-variant max-w-[140px] truncate">
              {email ?? "Guest"}
            </span>
            <a
              href="/auth/signout"
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              title="Sign out"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <span className="material-symbols-outlined text-[22px]">
              {menuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-border-hairline bg-surface-container-lowest px-margin py-space-base flex flex-col gap-space-xs">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2.5 rounded-lg font-body-medium text-body-medium transition-colors ${
                  active
                    ? "bg-surface-container-high text-on-surface font-semibold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-subtle"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="flex items-center gap-1.5 px-3 pt-space-sm mt-space-xs border-t border-border-hairline">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                quotaRemaining > 0 ? "bg-success" : "bg-error"
              }`}
            />
            <span className="font-body-meta text-body-meta text-on-surface-variant">
              {quotaRemaining}/5 calls left today
            </span>
          </div>
        </div>
      )}
    </header>
  );
}