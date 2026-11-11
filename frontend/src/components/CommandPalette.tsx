"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Team } from "@/lib/types";
import { useDialog } from "@/lib/useDialog";
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
 * is usable without the mouse. Focus is trapped while open and restored to the
 * trigger on close.
 */
export function CommandPalette({ teams }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialog<HTMLDivElement>(open, () => setOpen(false));

  // Hydration-safe platform label: the server always renders "Ctrl K", then the
  // client swaps to "⌘K" on Apple devices without an effect or a mismatch.
  const shortcut = useSyncExternalStore(
    () => () => {},
    () =>
      /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K",
    () => "Ctrl K"
  );

  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
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
  const activeId = items[activeIndex]?.id;

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
        aria-label="Search teams"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 text-[11.5px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <span className="hidden sm:inline">Search teams</span>
        <kbd className="hidden rounded-[5px] border border-line bg-surface-muted px-1 py-0.5 font-mono text-[9.5px] text-muted sm:inline">
          {shortcut}
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 cursor-pointer bg-black/35 backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Search teams"
              tabIndex={-1}
              className="fixed left-1/2 top-[12%] z-50 w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_40px_90px_-42px_rgb(21_23_20/0.55)] outline-none"
              initial={{ opacity: 0, y: -10, scale: 0.98, x: "-50%" }}
              animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
              exit={{ opacity: 0, y: -8, scale: 0.98, x: "-50%" }}
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
            >
              <div className="border-b border-line p-3">
                <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface-muted/40 px-3 transition-colors focus-within:border-signal focus-within:bg-surface">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="command-palette-list"
                    aria-activedescendant={
                      activeId ? `command-palette-${activeId}` : undefined
                    }
                    aria-autocomplete="list"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Search teams by name or abbreviation…"
                    className="w-full bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:outline-none sm:text-[14px]"
                  />
                  <kbd className="hidden shrink-0 rounded-[5px] border border-line bg-surface px-1 py-0.5 font-mono text-[9.5px] text-muted sm:inline">
                    esc
                  </kbd>
                </div>
              </div>

              <ul
                id="command-palette-list"
                role="listbox"
                aria-label="Teams"
                className="max-h-72 overflow-y-auto p-1.5"
              >
                {items.length === 0 && (
                  <li
                    role="status"
                    className="px-3 py-6 text-center text-[13px] text-muted"
                  >
                    No teams match “{query}”.
                  </li>
                )}
                {items.map((item, i) => (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      id={`command-palette-${item.id}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseEnter={() => setActive(i)}
                      onClick={item.run}
                      className={`relative flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors ${
                        i === activeIndex
                          ? "bg-surface-muted"
                          : "hover:bg-surface-muted/60"
                      }`}
                    >
                      {i === activeIndex && (
                        <span
                          className="absolute inset-y-2 left-1 w-[2px] rounded-full bg-signal"
                          aria-hidden="true"
                        />
                      )}
                      {item.abbr && <TeamBadge abbr={item.abbr} size="sm" />}
                      <span className="flex-1 font-medium text-ink">
                        {item.label}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                        {item.hint}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-muted/40 px-4 py-2.5 text-[10.5px] text-muted">
                <span className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <kbd className="rounded border border-line bg-surface px-1 font-mono text-[9px]">↑↓</kbd>
                    navigate
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="rounded border border-line bg-surface px-1 font-mono text-[9px]">↵</kbd>
                    open
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="rounded border border-line bg-surface px-1 font-mono text-[9px]">esc</kbd>
                    close
                  </span>
                </span>
                <span className="font-display text-[11px] font-semibold tabular-nums">
                  {teams.length} teams
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
