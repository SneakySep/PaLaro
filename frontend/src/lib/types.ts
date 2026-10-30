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
  confidence_interval: [number, number];
  model_version: string;
}

export interface Game {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  status: string;
}
