"use client";

import type { Season, Team } from "@/lib/types";
import { teamColor } from "@/lib/teamColors";

export interface GameFilterState {
  status: "" | "scheduled" | "final";
  team: string;
  season: string;
  /** ISO date (YYYY-MM-DD) or empty for no date bound. */
  dateFrom: string;
  dateTo: string;
}

interface GameFiltersProps {
  value: GameFilterState;
  onChange: (next: GameFilterState) => void;
  teams: Team[];
  seasons: Season[];
  resultCount?: number;
}

const STATUS_OPTIONS: { value: GameFilterState["status"]; label: string }[] = [
  { value: "", label: "All" },
  { value: "scheduled", label: "Upcoming" },
  { value: "final", label: "Completed" },
];

/**
 * Filter controls for the games list: status, team, and season.
 *
 * Team is a horizontally scrollable chip row rather than a `<select>` because
 * brand colors make teams far faster to scan than three-letter codes in a
 * dropdown.
 */
export function GameFilters({
  value,
  onChange,
  teams,
  seasons,
  resultCount,
}: GameFiltersProps) {
  const set = (patch: Partial<GameFilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Status
        </span>
        {STATUS_OPTIONS.map((opt) => {
          const active = value.status === opt.value;
          return (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => set({ status: opt.value })}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}

        <span className="ml-auto flex items-center gap-2">
          <label
            htmlFor="season-select"
            className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            Season
          </label>
          <select
            id="season-select"
            value={value.season}
            onChange={(e) => set({ season: e.target.value })}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <option value="">All seasons</option>
            {seasons.map((s) => (
              <option key={s.season} value={String(s.season)}>
                {s.season}-{String(s.season + 1).slice(2)} ({s.games})
              </option>
            ))}
          </select>
        </span>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Dates
        </span>
        <input
          type="date"
          value={value.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
          aria-label="From date"
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
        <span className="text-xs text-zinc-400">to</span>
        <input
          type="date"
          value={value.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
          aria-label="To date"
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
        {(value.dateFrom || value.dateTo) && (
          <button
            type="button"
            onClick={() => set({ dateFrom: "", dateTo: "" })}
            className="text-[10px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Team
          </span>
          {value.team && (
            <button
              type="button"
              onClick={() => set({ team: "" })}
              className="text-[10px] font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              clear
            </button>
          )}
          {resultCount != null && (
            <span className="ml-auto text-[10px] text-zinc-400">
              {resultCount} game{resultCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => set({ team: "" })}
            aria-pressed={value.team === ""}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value.team === ""
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            All
          </button>
          {teams.map((t) => {
            const active = value.team === t.abbr;
            const color = teamColor(t.abbr);
            return (
              <button
                key={t.abbr}
                type="button"
                onClick={() => set({ team: active ? "" : t.abbr })}
                aria-pressed={active}
                title={t.name}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
                  active
                    ? "border-transparent text-white shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
                style={
                  active
                    ? {
                        backgroundColor: color.primary,
                        color:
                          color.primary === "#C4CED4" ? "#0a0a0a" : "#ffffff",
                      }
                    : undefined
                }
              >
                {t.abbr}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
