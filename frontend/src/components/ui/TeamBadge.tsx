import { readableOn, teamColor } from "@/lib/teamColors";

interface TeamBadgeProps {
  abbr: string;
  /** `sm` for dense rows, `md` for cards, `lg` for the hero matchup. */
  size?: "sm" | "md" | "lg";
  /** Show the full team name beside the badge. */
  showName?: boolean;
  className?: string;
}

const SIZES = {
  sm: "h-6 w-6 text-[9px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-12 w-12 text-sm",
} as const;

/**
 * A team's abbreviation rendered on its brand color.
 *
 * Text color is derived from the brand color's luminance so light primaries
 * (SAS, BOS) get dark text instead of unreadable white.
 */
export function TeamBadge({
  abbr,
  size = "md",
  showName = false,
  className = "",
}: TeamBadgeProps) {
  const color = teamColor(abbr);
  const fg = readableOn(color.primary);

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-lg font-bold tracking-tight ring-1 ring-black/10 dark:ring-white/15 ${SIZES[size]}`}
        style={{ backgroundColor: color.primary, color: fg }}
        aria-hidden="true"
      >
        {abbr}
      </span>
      {showName && (
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {color.name}
        </span>
      )}
      <span className="sr-only">{abbr}</span>
    </span>
  );
}
