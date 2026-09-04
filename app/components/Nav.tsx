"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/templates", label: "Templates" },
  { href: "/call", label: "Custom Call" },
  { href: "/test-emergency", label: "Relay Message" },
];

export default function Nav() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
      <nav className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-zinc-900 tracking-tight shrink-0"
        >
          <CalleIcon />
          <span>CALL-E</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* User + signout */}
        <div className="hidden sm:flex items-center gap-3">
          {email && (
            <>
              <span className="text-sm text-zinc-400 max-w-[180px] truncate">
                {email}
              </span>
              <a
                href="/auth/signout"
                className="text-sm text-zinc-500 hover:text-zinc-800 px-2 py-1 rounded transition-colors"
              >
                Sign out
              </a>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <XIcon /> : <MenuIcon />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-zinc-100 bg-white px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {email && (
            <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-xs text-zinc-400 truncate">{email}</span>
              <a
                href="/auth/signout"
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                Sign out
              </a>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function CalleIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <rect width="22" height="22" rx="5" fill="#0055ff" />
      <path
        d="M6.5 11a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13.5 14.5 16 17"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
