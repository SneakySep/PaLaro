"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Team } from "@/lib/types";
import { teamColor } from "@/lib/teamColors";
import { TeamBadge } from "./ui/TeamBadge";

interface CommandPaletteProps {
  teams: Team[];
}

interface Item {
  id: string;
  label: string;
  hint: string;
  abbr?: string;
  run: () => void;
}

/**
 * ⌘K / Ctrl-K palette for jumping to a team page.
 *
 * Filters on abbreviation and full name, and supports arrow keys + Enter so it
 * is usable without the mouse.
 */
export function CommandPalette({ teams }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the query and focus the input when the panel opens. Done in the
  // open handler rather than an effect so it does not cascade a render.
  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          openPalette();
        }
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openPalette]);

  const items: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams
      .filter(
        (t) =>
          !q ||
          t.abbr.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((t) => ({
        id: t.abbr,
        label: t.name,
        hint: t.abbr,
        abbr: t.abbr,
        run: () => {
          router.push(`/teams/${t.abbr}`);
          setOpen(false);
        },
      }));
  }, [teams, query, router]);

  // Clamp the highlight when the result list shrinks. Derived during render
  // rather than in an effect, which would cascade an extra render.
  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(items.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[activeIndex]?.run();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        aria-label="Search teams"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <span className="hidden sm:inline">Search teams</span>
        <kbd className="hidden rounded border border-zinc-200 px-1 font-mono text-[10px] dark:border-zinc-600 sm:inline">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-label="Search teams"
              className="fixed left-1/2 top-[15%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search teams by name or abbreviation…"
                className="w-full border-b border-zinc-100 bg-transparent px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:border-zinc-800 dark:text-zinc-50"
              />
              <ul className="max-h-72 overflow-y-auto p-1.5">
                {items.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-zinc-400">
                    No teams match “{query}”.
                  </li>
                )}
                {items.map((item, i) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={item.run}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        i === activeIndex
                          ? "bg-zinc-100 dark:bg-zinc-800"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      {item.abbr && <TeamBadge abbr={item.abbr} size="sm" />}
                      <span className="flex-1 text-zinc-900 dark:text-zinc-50">
                        {item.label}
                      </span>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: item.abbr ? teamColor(item.abbr).primary : undefined }}
                      >
                        {item.hint}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
