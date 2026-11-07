export interface HealthResponse {
  status: string;
  app: string;
  version: string;
}

export interface PredictionResponse {
  game_id: string;
  home_team: string;
  away_team: string;
  home_win_prob: number; // 0..1
  model_version: string;
}

export interface UpcomingPrediction extends PredictionResponse {
  game_date: string; // ISO date (YYYY-MM-DD)
}

export interface Game {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  home_points: number | null;
  away_points: number | null;
  status: string;
}
