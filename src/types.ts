export type Rank = {
  ccf?: string;
  core?: string;
  thcpl?: string;
};

export type TimelineItem = {
  abstract_deadline?: string;
  deadline?: string;
  comment?: string;
};

export type ConferenceYear = {
  year: number;
  id: string;
  link: string;
  timeline: TimelineItem[];
  timezone: string;
  date: string;
  place: string;
};

export type AcceptanceRate = {
  year: number;
  submitted: number;
  accepted: number;
  rate: number;
  source?: string;
};

export type Venue = {
  title: string;
  description: string;
  sub: string;
  rank: Rank;
  dblp: string;
  acceptanceRate?: AcceptanceRate;
  confs: ConferenceYear[];
};

export type Dataset = {
  generatedAt: string;
  source: string;
  venues: Venue[];
};

export type DeadlineHit = {
  kind: "abstract" | "deadline";
  value: string;
  instant: Date;
  conf: ConferenceYear;
  comment?: string;
};

export type ViewRow = {
  venue: Venue;
  deadline: DeadlineHit | null;
  status: "upcoming" | "closed" | "unknown";
};

export type SortKey = "title" | "core" | "deadline" | "remaining";
export type SortDirection = "asc" | "desc";
export type ThemeMode = "light" | "dark";
export type FavoriteLayout = "unified" | "area";

export type StoredPreferences = {
  areas?: string[];
  coreRanks?: string[];
  sort?: SortKey;
  sortDirection?: SortDirection;
  favoriteLayout?: FavoriteLayout;
  favoriteCollapsed?: boolean;
  matrixPaused?: boolean;
};

export const AREA_NAMES: Record<string, string> = {
  AI: "Artificial Intelligence",
  CG: "Graphics",
  CT: "Computing Theory",
  DB: "Database",
  DS: "Computer Architecture",
  HI: "Human-Computer Interaction",
  MX: "Interdiscipline",
  NW: "Network System",
  SC: "Security",
  SE: "Software Engineering",
};

export const RANK_ORDER: Record<string, number> = {
  "A*": 0,
  A: 1,
  B: 2,
  C: 3,
  N: 4,
};
