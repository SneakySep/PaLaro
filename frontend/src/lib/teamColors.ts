/**
 * NBA team brand colors.
 *
 * `primary` is the team's main brand color, `secondary` its accent. Several
 * primaries are very light (BOS, SAS, MIA) or very dark (BKN, CHI), so anything
 * that puts text on a team color must use `readableOn()` rather than assuming
 * white text works.
 */
export interface TeamColor {
  primary: string;
  secondary: string;
  /** Short display name, used where the abbreviation alone is too terse. */
  name: string;
}

export const TEAM_COLORS: Record<string, TeamColor> = {
  ATL: { primary: "#E03A3E", secondary: "#C1D32F", name: "Hawks" },
  BKN: { primary: "#000000", secondary: "#FFFFFF", name: "Nets" },
  BOS: { primary: "#007A33", secondary: "#BA9653", name: "Celtics" },
  CHA: { primary: "#1D1160", secondary: "#00788C", name: "Hornets" },
  CHI: { primary: "#CE1141", secondary: "#000000", name: "Bulls" },
  CLE: { primary: "#860038", secondary: "#FDBB30", name: "Cavaliers" },
  DAL: { primary: "#00538C", secondary: "#B8C4CA", name: "Mavericks" },
  DEN: { primary: "#0E2240", secondary: "#FEC524", name: "Nuggets" },
  DET: { primary: "#C8102E", secondary: "#1D42BA", name: "Pistons" },
  GSW: { primary: "#1D428A", secondary: "#FFC72C", name: "Warriors" },
  HOU: { primary: "#CE1141", secondary: "#000000", name: "Rockets" },
  IND: { primary: "#002D62", secondary: "#FDBB30", name: "Pacers" },
  LAC: { primary: "#C8102E", secondary: "#1D428A", name: "Clippers" },
  LAL: { primary: "#552583", secondary: "#FDB927", name: "Lakers" },
  MEM: { primary: "#5D76A9", secondary: "#12173F", name: "Grizzlies" },
  MIA: { primary: "#98002E", secondary: "#F9A01B", name: "Heat" },
  MIL: { primary: "#00471B", secondary: "#EEE1C6", name: "Bucks" },
  MIN: { primary: "#0C2340", secondary: "#236192", name: "Timberwolves" },
  NOP: { primary: "#0C2340", secondary: "#C8102E", name: "Pelicans" },
  NYK: { primary: "#006BB6", secondary: "#F58426", name: "Knicks" },
  OKC: { primary: "#007AC1", secondary: "#EF3B24", name: "Thunder" },
  ORL: { primary: "#0077C0", secondary: "#C4CED4", name: "Magic" },
  PHI: { primary: "#006BB6", secondary: "#ED174C", name: "76ers" },
  PHX: { primary: "#1D1160", secondary: "#E56020", name: "Suns" },
  POR: { primary: "#E03A3E", secondary: "#000000", name: "Trail Blazers" },
  SAC: { primary: "#5A2D81", secondary: "#63727A", name: "Kings" },
  SAS: { primary: "#C4CED4", secondary: "#000000", name: "Spurs" },
  TOR: { primary: "#CE1141", secondary: "#000000", name: "Raptors" },
  UTA: { primary: "#002B5C", secondary: "#F9A01B", name: "Jazz" },
  WAS: { primary: "#002B5C", secondary: "#E31837", name: "Wizards" },
};

const FALLBACK: TeamColor = {
  primary: "#71717a",
  secondary: "#a1a1aa",
  name: "Team",
};

export function teamColor(abbr: string): TeamColor {
  return TEAM_COLORS[abbr?.toUpperCase()] ?? FALLBACK;
}

/** Relative luminance per WCAG 2.1, used to pick readable text on a color. */
function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Returns near-black or near-white, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.45 ? "#0a0a0a" : "#ffffff";
}
