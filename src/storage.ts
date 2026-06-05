import { AREA_NAMES, type FavoriteLayout, type SortKey, type StoredPreferences } from "./types";

const PREFERENCES_KEY = "cs-venues-table-preferences";
const FAVORITES_KEY = "cs-venues-favorites";
const CORE_RANKS = ["A*", "A", "B", "C", "N"];

export function readStoredPreferences(): Required<StoredPreferences> {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    return normalizeStoredPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeStoredPreferences(null);
  }
}

export function writeStoredPreferences(preferences: StoredPreferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage failures; URL state still keeps the app shareable.
  }
}

export function normalizeStoredPreferences(value: unknown): Required<StoredPreferences> {
  const defaults: Required<StoredPreferences> = {
    areas: [],
    coreRanks: ["A*", "A"],
    sort: "remaining",
    sortDirection: "asc",
    favoriteLayout: "unified",
    favoriteCollapsed: false,
    matrixPaused: false,
  };
  if (!value || typeof value !== "object") return defaults;
  const parsed = value as StoredPreferences;
  const storedSort = parsed.sort ?? null;
  return {
    areas: Array.isArray(parsed.areas) ? parsed.areas.filter(isKnownArea) : defaults.areas,
    coreRanks: Array.isArray(parsed.coreRanks) ? parsed.coreRanks.filter(isKnownCoreRank) : defaults.coreRanks,
    sort: isSortKey(storedSort) ? storedSort : defaults.sort,
    sortDirection: parsed.sortDirection === "desc" ? "desc" : defaults.sortDirection,
    favoriteLayout: isFavoriteLayout(parsed.favoriteLayout) ? parsed.favoriteLayout : defaults.favoriteLayout,
    favoriteCollapsed: typeof parsed.favoriteCollapsed === "boolean" ? parsed.favoriteCollapsed : defaults.favoriteCollapsed,
    matrixPaused: typeof parsed.matrixPaused === "boolean" ? parsed.matrixPaused : defaults.matrixPaused,
  };
}

export function readStoredFavorites(): Set<string> {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeStoredFavorites(favorites: Iterable<string>): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites].sort()));
  } catch {
    // Favorites are progressive enhancement; the table remains usable without storage.
  }
}

function isSortKey(value: string | null): value is SortKey {
  return value === "title" || value === "core" || value === "deadline" || value === "remaining";
}

function isKnownArea(value: unknown): value is string {
  return typeof value === "string" && (value in AREA_NAMES);
}

function isKnownCoreRank(value: unknown): value is string {
  return typeof value === "string" && CORE_RANKS.includes(value);
}

function isFavoriteLayout(value: unknown): value is FavoriteLayout {
  return value === "unified" || value === "area";
}
