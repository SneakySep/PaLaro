import type { Game, HealthResponse, UpcomingPrediction } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  return parse<HealthResponse>(await fetch(`${API_URL}/health`));
}

export async function getGames(status?: string): Promise<Game[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const qs = params.toString();
  return parse<Game[]>(
    await fetch(`${API_URL}/api/v1/games${qs ? `?${qs}` : ""}`)
  );
}

export async function getUpcomingPredictions(
  days = 7
): Promise<UpcomingPrediction[]> {
  return parse<UpcomingPrediction[]>(
    await fetch(`${API_URL}/api/v1/predict/upcoming?days=${days}`)
  );
}
