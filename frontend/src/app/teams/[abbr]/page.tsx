"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getTeamDetail } from "@/lib/api";
import type { FormBucket } from "@/lib/types";
import { readableOn, teamColor } from "@/lib/teamColors";
import { TeamBadge } from "@/components/ui/TeamBadge";

function StatCard({
  label,
  bucket,
  accent,
}: {
  label: string;
  bucket: FormBucket;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
        {bucket.wins}
        <span className="text-zinc-400">–</span>
        {bucket.losses}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(bucket.win_rate * 100)}%`,
            backgroundColor: accent,
          }}
        />
      </div>
      <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        {bucket.games > 0
          ? `${bucket.pts_for} for · ${bucket.pts_against} against`
          : "No games played"}
      </p>
      {bucket.games > 0 && (
        <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          {bucket.margin > 0 ? "+" : ""}
          {bucket.margin} margin
        </p>
      )}
    </div>
  );
}

export default function TeamPage({
  params,
}: {
  params: Promise<{ abbr: string }>;
}) {
  return (
    <Suspense fallback={<TeamPageSkeleton />}>
      <TeamDetailView params={params} />
    </Suspense>
  );
}

function TeamPageSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
    </div>
  );
}

function TeamDetailView({
  params,
}: {
  params: Promise<{ abbr: string }>;
}) {
  const { abbr } = use(params);
  const code = abbr.toUpperCase();
  const color = teamColor(code);
  const onColor = readableOn(color.primary);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["team", code],
    queryFn: () => getTeamDetail(code),
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10">
        <p className="text-sm text-zinc-500">
          {(error as Error)?.message ?? "Team not found."}
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to games
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 sm:px-6 dark:bg-black">
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-4xl"
      >
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← All games
        </Link>

        <header
          className="mb-6 overflow-hidden rounded-2xl p-6"
          style={{ backgroundColor: color.primary, color: onColor }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold backdrop-blur-sm"
                style={{ color: onColor }}
              >
                {data.abbr}
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
                <p className="text-sm opacity-80">
                  {[data.conference, data.division].filter(Boolean).join(" · ") ||
                    "NBA"}
                </p>
              </div>
            </div>

            {data.streak && (
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  Streak
                </p>
                <p className="text-2xl font-bold tabular-nums">{data.streak}</p>
              </div>
            )}
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Overall" bucket={data.overall} accent={color.primary} />
          <StatCard label="Home" bucket={data.home} accent={color.primary} />
          <StatCard label="Away" bucket={data.away} accent={color.secondary} />
          <StatCard label="Last 10" bucket={data.last10} accent={color.secondary} />
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Recent results
            </h2>
            <div className="flex flex-col gap-1.5">
              {data.recent.length === 0 && (
                <p className="text-sm text-zinc-500">No completed games.</p>
              )}
              {data.recent.map((g) => {
                const opp = g.is_home ? g.away_team : g.home_team;
                return (
                  <div
                    key={g.game_id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                          g.won
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                            : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                        }`}
                      >
                        {g.won ? "W" : "L"}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {g.is_home ? "vs" : "@"}
                      </span>
                      <TeamBadge abbr={opp} size="sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400">
                        {new Date(`${g.date}T12:00:00Z`).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                      <span className="text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                        {g.margin != null && g.margin > 0 ? "+" : ""}
                        {g.margin}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Upcoming
            </h2>
            <div className="flex flex-col gap-1.5">
              {data.upcoming.length === 0 && (
                <p className="text-sm text-zinc-500">No scheduled games.</p>
              )}
              {data.upcoming.map((g) => {
                const opp = g.is_home ? g.away_team : g.home_team;
                return (
                  <div
                    key={g.game_id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">
                        {g.is_home ? "vs" : "@"}
                      </span>
                      <TeamBadge abbr={opp} size="sm" />
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      {new Date(`${g.date}T12:00:00Z`).toLocaleDateString(
                        "en-US",
                        { weekday: "short", month: "short", day: "numeric" }
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </motion.main>
    </div>
  );
}
