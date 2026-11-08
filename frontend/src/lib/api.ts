import type {
  Game,
  HealthResponse,
  ModelMetrics,
  Season,
  Team,
  TeamDetail,
  UpcomingPrediction,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  return parse<HealthResponse>(await fetch(`${API_URL}/health`));
}

export interface GameFilters {
  status?: string;
  team?: string;
  season?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export async function getGames(filters: GameFilters = {}): Promise<Game[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.team) params.set("team", filters.team);
  if (filters.season != null) params.set("season", String(filters.season));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return parse<Game[]>(await fetch(`${API_URL}/api/v1/games${qs ? `?${qs}` : ""}`));
}

export async function getTeams(): Promise<Team[]> {
  return parse<Team[]>(await fetch(`${API_URL}/api/v1/teams`));
}

export async function getTeamDetail(
  abbr: string,
  season?: number
): Promise<TeamDetail> {
  const qs = season != null ? `?season=${season}` : "";
  return parse<TeamDetail>(
    await fetch(`${API_URL}/api/v1/teams/${encodeURIComponent(abbr)}${qs}`)
  );
}

export async function getModelMetrics(): Promise<ModelMetrics> {
  return parse<ModelMetrics>(await fetch(`${API_URL}/api/v1/model/metrics`));
}

export async function getSeasons(): Promise<Season[]> {
  return parse<Season[]>(await fetch(`${API_URL}/api/v1/seasons`));
}

export async function getUpcomingPredictions(
  days = 7
): Promise<UpcomingPrediction[]> {
  return parse<UpcomingPrediction[]>(
    await fetch(`${API_URL}/api/v1/predict/upcoming?days=${days}`)
  );
}

/** ISO date (YYYY-MM-DD) offset from today by `days`. */
export function isoDate(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
