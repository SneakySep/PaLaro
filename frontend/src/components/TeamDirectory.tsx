"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getTeams } from "@/lib/api";
import { teamColor } from "@/lib/teamColors";
import { TeamBadge } from "./ui/TeamBadge";
import { ThemeToggle } from "./ui/ThemeToggle";

/** Full league directory: every team, searchable by name or abbreviation. */
export function TeamDirectory() {
  const [query, setQuery] = useState("");
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: getTeams });

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return teams;
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(search) ||
        team.abbr.toLowerCase().includes(search)
    );
  }, [teams, query]);

  return (
    <div className="relative flex flex-1 flex-col bg-canvas">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] overflow-hidden">
        <div className="court-lines" />
      </div>

      <div className="relative flex flex-1 flex-col items-center px-4 pb-16 pt-6 sm:px-8 sm:pt-8">
        <div className="w-full max-w-[1440px]">
          <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
            <div className="flex items-center gap-5">
              <Link
                href="/"
                className="rounded font-display text-[26px] font-semibold leading-none tracking-[-0.01em] text-ink"
                aria-label="PaLaro home"
              >
                PaLaro
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted transition-colors hover:text-ink"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Dashboard
              </Link>
            </div>
            <ThemeToggle />
          </header>

          <motion.main
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="pt-8"
          >
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[11px] font-medium text-muted">
                  League directory
                </p>
                <h1 className="mt-1.5 font-display text-[40px] font-semibold leading-[0.98] tracking-[-0.015em] text-ink sm:text-[46px] xl:text-[52px]">
                  Teams
                </h1>
                <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted">
                  {teamsQuery.isSuccess
                    ? query
                      ? `${filtered.length} of ${teams.length} teams match your search.`
                      : `All ${teams.length} franchises, from Atlanta to Washington.`
                    : "Every franchise in the league."}
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <svg
                  width="15"
                  height="15"
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search teams…"
                  aria-label="Search teams"
                  className="control control-search w-full"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[7px] text-muted transition-colors hover:bg-surface-muted hover:text-ink"
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

            {teamsQuery.isLoading && (
              <div
                role="status"
                aria-label="Loading teams"
                aria-busy="true"
                className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
              >
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="panel flex h-[112px] items-center gap-3 p-4">
                    <div className="skeleton h-[72px] w-[72px] shrink-0 rounded-[16px]" />
                    <div className="flex-1">
                      <div className="skeleton h-4 w-28 rounded" />
                      <div className="skeleton mt-2 h-2.5 w-12 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {teamsQuery.isError && (
              <div className="panel mt-7 flex flex-col items-center gap-3 p-10 text-center">
                <p className="text-[13px] text-muted">
                  We couldn&apos;t load the team directory.
                </p>
                <button
                  type="button"
                  onClick={() => teamsQuery.refetch()}
                  className="text-link text-[12px]"
                >
                  Try again
                </button>
              </div>
            )}

            {teamsQuery.isSuccess && filtered.length > 0 && (
              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {filtered.map((team) => (
                  <Link
                    key={team.abbr}
                    href={`/teams/${team.abbr}`}
                    className="panel panel-hover group relative flex h-full min-h-[112px] items-center gap-3 overflow-hidden p-4"
                  >
                    <span
                      className="absolute inset-x-0 top-0 h-[3px]"
                      style={{ backgroundColor: teamColor(team.abbr).primary }}
                      aria-hidden="true"
                    />
                    <span className="inline-flex shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5">
                      <TeamBadge abbr={team.abbr} size="xl" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-[17px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink">
                        {team.name}
                      </span>
                      <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                        {team.abbr}
                        <span aria-hidden="true">·</span>
                        <span className="normal-case tracking-normal">
                          View team
                        </span>
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {teamsQuery.isSuccess && filtered.length === 0 && (
              <div className="panel mt-7 flex flex-col items-center gap-2 p-10 text-center">
                <p className="text-[13px] text-muted">
                  No teams match “{query}”.
                </p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-link text-[12px]"
                >
                  Clear search
                </button>
              </div>
            )}

            <footer className="mt-12 border-t border-line pt-6">
              <p className="text-[11px] text-muted/80">
                Team logos are property of their respective NBA teams.
              </p>
            </footer>
          </motion.main>
        </div>
      </div>
    </div>
  );
}
