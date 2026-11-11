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

/** Error carrying the HTTP status plus the API's `detail` message when present. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail.trim()) {
        message = body.detail;
      }
    } catch {
      // The body was not JSON; keep the generic status message.
    }
    throw new ApiError(res.status, message);
  }
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

export interface GamesPage {
  games: Game[];
  /** Total matching rows, independent of the current limit/offset. */
  total: number;
}

export async function getGames(filters: GameFilters = {}): Promise<GamesPage> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.team) params.set("team", filters.team);
  if (filters.season != null) params.set("season", String(filters.season));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  const qs = params.toString();

  const res = await fetch(`${API_URL}/api/v1/games${qs ? `?${qs}` : ""}`);
  const games = await parse<Game[]>(res);
  const header = res.headers.get("X-Total-Count");
  const parsedTotal = header != null ? Number(header) : Number.NaN;
  return {
    games,
    total: Number.isFinite(parsedTotal) ? parsedTotal : games.length,
  };
}

export async function getTeams(): Promise<Team[]> {
  return parse<Team[]>(await fetch(`${API_URL}/api/v1/teams`));
}

export async function getTeamDetail(
  abbr: string,
  season?: number,
  allSeasons = false
): Promise<TeamDetail> {
  const params = new URLSearchParams();
  if (season != null) params.set("season", String(season));
  if (allSeasons) params.set("all_seasons", "true");
  const qs = params.toString();
  return parse<TeamDetail>(
    await fetch(
      `${API_URL}/api/v1/teams/${encodeURIComponent(abbr)}${qs ? `?${qs}` : ""}`
    )
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
