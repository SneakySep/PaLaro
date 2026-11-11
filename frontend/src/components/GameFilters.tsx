"use client";

import { useMemo, useState } from "react";
import type { Season, Team } from "@/lib/types";
import { TeamBadge } from "./ui/TeamBadge";

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
  isFetching?: boolean;
}

const STATUS_OPTIONS: { value: GameFilterState["status"]; label: string }[] = [
  { value: "", label: "All" },
  { value: "scheduled", label: "Upcoming" },
  { value: "final", label: "Completed" },
];

/**
 * Filter controls for the games list: status, team, season, and dates.
 *
 * On narrow screens this is a full-width panel. On wide screens the parent
 * places it in a sticky left rail, so the same markup switches to a vertical
 * layout and the team row becomes a searchable two-column logo grid.
 */
export function GameFilters({
  value,
  onChange,
  teams,
  seasons,
  resultCount,
  isFetching = false,
}: GameFiltersProps) {
  const [teamQuery, setTeamQuery] = useState("");

  const set = (patch: Partial<GameFilterState>) =>
    onChange({ ...value, ...patch });

  const activeCount = [
    value.status !== "",
    value.team !== "",
    value.season !== "",
    value.dateFrom !== "" || value.dateTo !== "",
  ].filter(Boolean).length;

  const clearAll = () => {
    setTeamQuery("");
    onChange({
      status: "",
      team: "",
      season: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const filteredTeams = useMemo(() => {
    const query = teamQuery.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(query) ||
        team.abbr.toLowerCase().includes(query)
    );
  }, [teams, teamQuery]);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
            Filters
          </h2>
          <span className="text-[11px] text-muted">
            {activeCount > 0
              ? `${activeCount} active`
              : "Nothing filtered"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-medium text-muted underline-offset-3 transition-colors hover:text-ink hover:underline"
            >
              Clear all
            </button>
          )}
          <span
            aria-live="polite"
            className="inline-flex items-baseline gap-1.5 text-[11px] text-muted"
          >
            {isFetching ? (
              "Updating…"
            ) : resultCount != null ? (
              <>
                <span className="font-display text-[14px] font-semibold tabular-nums text-ink">
                  {resultCount.toLocaleString()}
                </span>
                {resultCount === 1 ? "game" : "games"}
              </>
            ) : null}
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-5 sm:gap-y-3 xl:flex-col xl:items-stretch xl:gap-4">
        <div className="flex flex-col gap-1.5 xl:w-full">
          <span
            id="status-filter-label"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
          >
            Status
          </span>
          <div
            role="group"
            aria-labelledby="status-filter-label"
            className="inline-flex w-fit max-w-full gap-0.5 rounded-[10px] border border-line bg-surface-muted/70 p-0.5 xl:flex xl:w-full"
          >
            {STATUS_OPTIONS.map((opt) => {
              const active = value.status === opt.value;
              return (
                <button
                  key={opt.value || "all"}
                  type="button"
                  onClick={() => set({ status: opt.value })}
                  aria-pressed={active}
                  className={`min-h-9 rounded-[8px] px-3 text-[11.5px] font-medium transition-colors xl:flex-1 ${
                    active
                      ? "bg-surface text-ink shadow-[0_1px_2px_rgb(21_23_20/0.08)]"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 xl:w-full">
          <label
            htmlFor="season-select"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
          >
            Season
          </label>
          <select
            id="season-select"
            value={value.season}
            onChange={(e) => set({ season: e.target.value })}
            className="control select-control w-full sm:w-auto xl:w-full"
          >
            <option value="">All seasons</option>
            {seasons.map((s) => (
              <option key={s.season} value={String(s.season)}>
                {s.season}-{String(s.season + 1).slice(2)} ({s.games})
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto lg:ml-auto xl:ml-0 xl:w-full">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Date range
          </span>
          <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center xl:flex-col xl:items-stretch">
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-8 shrink-0 text-[11px] text-muted sm:hidden xl:inline">
                From
              </span>
              <input
                type="date"
                value={value.dateFrom}
                onChange={(e) => set({ dateFrom: e.target.value })}
                aria-label="From date"
                className="control min-w-0 flex-1 sm:flex-none xl:flex-1"
              />
            </div>
            <span className="hidden text-[11px] text-muted sm:inline xl:hidden">
              to
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-8 shrink-0 text-[11px] text-muted sm:hidden xl:inline">
                To
              </span>
              <input
                type="date"
                value={value.dateTo}
                onChange={(e) => set({ dateTo: e.target.value })}
                aria-label="To date"
                className="control min-w-0 flex-1 sm:flex-none xl:flex-1"
              />
              {(value.dateFrom || value.dateTo) && (
                <button
                  type="button"
                  onClick={() => set({ dateFrom: "", dateTo: "" })}
                  className="btn min-h-9 shrink-0 px-2 text-muted"
                  aria-label="Clear date range"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span
            id="team-filter-label"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
          >
            Team
          </span>
          <span className="text-[11px] tabular-nums text-muted xl:inline">
            {teams.length}
          </span>
        </div>

        <div className="relative mt-2 hidden xl:block">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={teamQuery}
            onChange={(e) => setTeamQuery(e.target.value)}
            placeholder="Find a team…"
            aria-label="Find a team"
            className="control control-search w-full"
          />
          {teamQuery && (
            <button
              type="button"
              onClick={() => setTeamQuery("")}
              aria-label="Clear team search"
              className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[7px] text-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div
          role="group"
          aria-labelledby="team-filter-label"
          className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 xl:grid xl:max-h-56 xl:grid-cols-2 xl:overflow-y-auto xl:overflow-x-hidden xl:pb-2"
        >
          <button
            type="button"
            onClick={() => set({ team: "" })}
            aria-pressed={value.team === ""}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-[11.5px] font-medium transition-colors xl:col-span-2 xl:justify-center ${
              value.team === ""
                ? "border-transparent bg-ink text-canvas"
                : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            All teams
          </button>
          {filteredTeams.map((t) => {
            const active = value.team === t.abbr;
            return (
              <button
                key={t.abbr}
                type="button"
                onClick={() => set({ team: active ? "" : t.abbr })}
                aria-pressed={active}
                aria-label={t.name}
                title={t.name}
                className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-semibold transition-colors ${
                  active
                    ? "border-transparent bg-ink text-canvas"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                <TeamBadge abbr={t.abbr} size="xs" />
                {t.abbr}
              </button>
            );
          })}
          {filteredTeams.length === 0 && (
            <p className="col-span-2 px-2 py-3 text-center text-[11.5px] text-muted">
              No teams match “{teamQuery}”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
