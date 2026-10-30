import type { HealthResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  return parse<HealthResponse>(await fetch(`${API_URL}/health`));
}
