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
  explanations: Contribution[];
}

export interface Contribution {
  feature: string;
  label: string;
  group: string;
  value: number;
  /** Probability points added; positive favors the home team. */
  impact: number;
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
  season?: number | null;
}

export interface Team {
  id: number;
  abbr: string;
  name: string;
}

export interface Season {
  season: number;
  games: number;
}

export interface ModelMetrics {
  version: string;
  accuracy: number | null;
  log_loss: number | null;
  roc_auc: number | null;
  n_features: number;
  trained_at: string | null;
}

export interface FormBucket {
  games: number;
  wins: number;
  losses: number;
  win_rate: number;
  pts_for: number;
  pts_against: number;
  margin: number;
}

export interface TeamGame {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  home_points: number | null;
  away_points: number | null;
  status: string;
  is_home: boolean;
  won: boolean | null;
  margin: number | null;
}

export interface TeamDetail {
  abbr: string;
  name: string;
  city: string | null;
  conference: string | null;
  division: string | null;
  season: number | null;
  seasons: number[];
  overall: FormBucket;
  home: FormBucket;
  away: FormBucket;
  last10: FormBucket;
  streak: string | null;
  recent: TeamGame[];
  upcoming: TeamGame[];
}
