import { readStoredPreferences } from "./storage";
import type { FavoriteLayout, SortDirection, SortKey, StoredPreferences, ThemeMode } from "./types";

export type InitialUiState = {
  query: string;
  areas: string[];
  coreRanks: string[];
  sort: SortKey;
  sortDirection: SortDirection;
  theme: ThemeMode;
  explicitTheme: boolean;
  favoriteLayout: FavoriteLayout;
  favoriteCollapsed: boolean;
  matrixPaused: boolean;
};

export type UrlWritableState = {
  query: string;
  areas: readonly string[];
  coreRanks: readonly string[];
  sort: SortKey;
  sortDirection: SortDirection;
  explicitTheme: boolean;
  theme: ThemeMode;
};

export function readInitialUiState(): InitialUiState {
  const params = new URLSearchParams(window.location.search);
  const sortParam = params.get("sort");
  const stored = readStoredPreferences();
  // Theme is resolved and applied before first paint by the boot script in
  // index.html; read its result here instead of recomputing the rule.
  const root = document.documentElement;
  const domTheme = root.dataset.theme;
  return {
    query: params.get("q") ?? "",
    areas: params.has("area") ? parseListParam(params.get("area")) : stored.areas,
    coreRanks: params.has("core") ? parseRankParam(params.get("core"), ["A*", "A"]) : stored.coreRanks,
    sort: params.has("sort") ? parseSortKey(sortParam) : stored.sort,
    sortDirection: params.has("dir") && isSortKey(sortParam) ? parseSortDirection(params.get("dir")) : stored.sortDirection,
    theme: domTheme === "dark" || domTheme === "light" ? domTheme : preferredTheme(),
    explicitTheme: root.dataset.themeExplicit === "1",
    favoriteLayout: stored.favoriteLayout,
    favoriteCollapsed: stored.favoriteCollapsed,
    matrixPaused: stored.matrixPaused,
  };
}

export function writeUrl(state: UrlWritableState): void {
  const params = new URLSearchParams();
  params.set("q", state.query);
  params.set("area", encodeListParam(state.areas));
  params.set("core", encodeListParam(state.coreRanks));
  params.set("sort", state.sort);
  params.set("dir", state.sortDirection);
  if (state.explicitTheme) {
    params.set("theme", state.theme);
  }
  window.history.replaceState(null, "", `?${params.toString()}`);
}

export function preferredTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function parseSortKey(value: string | null): SortKey {
  return isSortKey(value) ? value : "remaining";
}

function isSortKey(value: string | null): value is SortKey {
  return value === "title" || value === "core" || value === "deadline" || value === "remaining";
}

function parseSortDirection(value: string | null): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

function parseListParam(value: string | null): string[] {
  if (!value || value === "all") return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseRankParam(value: string | null, fallback: string[]): string[] {
  if (!value) return [...fallback];
  if (value === "all") return [];
  if (value === "A_OR_BETTER") return ["A*", "A"];
  return parseListParam(value);
}

function encodeListParam(values: readonly string[]): string {
  return values.length ? values.join(",") : "all";
}

export function currentStoredPreferences(state: Required<Pick<StoredPreferences, "areas" | "coreRanks" | "sort" | "sortDirection" | "favoriteLayout" | "favoriteCollapsed" | "matrixPaused">>): StoredPreferences {
  return {
    areas: state.areas,
    coreRanks: state.coreRanks,
    sort: state.sort,
    sortDirection: state.sortDirection,
    favoriteLayout: state.favoriteLayout,
    favoriteCollapsed: state.favoriteCollapsed,
    matrixPaused: state.matrixPaused,
  };
}
