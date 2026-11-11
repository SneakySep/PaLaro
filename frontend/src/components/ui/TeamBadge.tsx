import Image from "next/image";
import { readableOn, teamColor, teamLogo } from "@/lib/teamColors";

interface TeamBadgeProps {
  abbr: string;
  /** `xs` for filter chips, `sm` for dense rows, `md` for controls, `lg` for cards and the drawer. */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Show the full team name beside the logo. */
  showName?: boolean;
  className?: string;
}

const TILE_SIZES = {
  xs: "h-5 w-5 rounded-[5px] p-[1px]",
  sm: "h-7 w-7 rounded-[7px] p-[2px]",
  md: "h-10 w-10 rounded-[10px] p-1",
  lg: "h-14 w-14 rounded-[12px] p-1.5",
  xl: "h-[72px] w-[72px] rounded-[16px] p-2",
} as const;

const FALLBACK_SIZES = {
  xs: "text-[8.5px]",
  sm: "text-[9.5px]",
  md: "text-[11.5px]",
  lg: "text-[15px]",
  xl: "text-[18px]",
} as const;

/**
 * A team's official logo on a small chalk plate.
 *
 * The plate keeps black-and-white marks (Nets, Spurs) readable in dark mode
 * without tinting or altering the official colors. If an asset is ever
 * missing, the component falls back to the old brand-color abbreviation tile.
 */
export function TeamBadge({
  abbr,
  size = "md",
  showName = false,
  className = "",
}: TeamBadgeProps) {
  const color = teamColor(abbr);
  const logo = teamLogo(abbr);

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {logo ? (
        <span
          className={`inline-flex shrink-0 items-center justify-center bg-[#f4f3ec] ring-1 ring-black/10 dark:bg-[#f1f0e9] dark:ring-white/20 ${TILE_SIZES[size]}`}
          aria-hidden="true"
        >
          <Image
            src={logo}
            alt=""
            width={80}
            height={80}
            className="h-full w-full object-contain"
          />
        </span>
      ) : (
        <span
          className={`font-display inline-flex shrink-0 items-center justify-center font-semibold tracking-[0.02em] ring-1 ring-black/10 dark:ring-white/15 ${TILE_SIZES[size]} ${FALLBACK_SIZES[size]}`}
          style={{ backgroundColor: color.primary, color: readableOn(color.primary) }}
          aria-hidden="true"
        >
          {abbr}
        </span>
      )}
      {showName && (
        <span className="text-sm font-medium text-ink">{color.name}</span>
      )}
    </span>
  );
}
