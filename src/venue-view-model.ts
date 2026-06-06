import { latestUpcomingTime, nextDeadline, projectedCycleTime } from "./deadlines";
import { AREA_NAMES, RANK_ORDER, type Dataset, type SortDirection, type SortKey, type Venue, type ViewRow } from "./types";

export type VenueFilters = {
  query: string;
  areas: readonly string[];
  coreRanks: readonly string[];
};

export type VenueSort = {
  sort: SortKey;
  sortDirection: SortDirection;
};

export type BuildRowsOptions = VenueFilters & VenueSort & {
  dataset: Dataset;
  now: Date;
};

export type BuildFavoriteRowsOptions = VenueSort & {
  dataset: Dataset;
  favoriteVenues: ReadonlySet<string>;
  now: Date;
};

export type FavoriteVenueGroup = {
  area: string;
  rows: ViewRow[];
};

export function createViewRow(venue: Venue, now: Date): ViewRow {
  const deadline = nextDeadline(venue, now);
  return {
    venue,
    deadline,
    status: deadline ? (deadline.instant > now ? "upcoming" : "closed") : "unknown",
  };
}

export function filteredRows(options: BuildRowsOptions): ViewRow[] {
  const query = normalizeQuery(options.query);
  const rows = options.dataset.venues
    .filter((venue) => rankMatches(venue.rank.core, options.coreRanks))
    .filter((venue) => areaMatches(venue.sub, options.areas))
    .map((venue) => createViewRow(venue, options.now))
    .filter((row) => !query || searchable(row.venue).includes(query));

  return sortRows(rows, options);
}

export function favoriteRows(options: BuildFavoriteRowsOptions): ViewRow[] {
  const rows = options.dataset.venues
    .filter((venue) => options.favoriteVenues.has(venue.title))
    .map((venue) => createViewRow(venue, options.now));

  return sortRows(rows, options);
}

export function searchable(venue: Venue): string {
  return [
    venue.title,
    venue.description,
    venue.sub,
    venue.rank.core,
    venue.rank.thcpl,
    venue.dblp,
  ].join(" ").toLowerCase();
}

export function rankMatches(value: string | undefined, filter: readonly string[]): boolean {
  const rank = value || "N";
  if (!filter.length) return true;
  return filter.includes(rank);
}

export function areaMatches(value: string, filter: readonly string[]): boolean {
  return !filter.length || filter.includes(value);
}

export function sortRows(rows: readonly ViewRow[], options: VenueSort & { now: Date }): ViewRow[] {
  const cycleAnchor = latestUpcomingTime([...rows], options.now);
  return [...rows].sort((a, b) => compareRows(a, b, options, cycleAnchor));
}

export function compareRows(
  a: ViewRow,
  b: ViewRow,
  options: VenueSort,
  cycleAnchor = Date.now(),
): number {
  if (options.sort === "remaining") {
    return compareRemaining(a, b, options.sortDirection, cycleAnchor);
  }

  const av = sortValue(a, options.sort);
  const bv = sortValue(b, options.sort);
  const direction = options.sortDirection === "asc" ? 1 : -1;
  if (typeof av === "number" || typeof bv === "number") {
    return (Number(av) - Number(bv)) * direction;
  }
  return av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true }) * direction;
}

export function compareRemaining(
  a: ViewRow,
  b: ViewRow,
  sortDirection: SortDirection,
  cycleAnchor: number,
): number {
  const ag = remainingGroup(a);
  const bg = remainingGroup(b);
  if (ag !== bg) return ag - bg;

  const av = remainingSortTime(a, cycleAnchor);
  const bv = remainingSortTime(b, cycleAnchor);
  const direction = sortDirection === "asc" ? 1 : -1;
  return (av - bv) * direction;
}

export function groupedFavoriteRows(rows: readonly ViewRow[]): FavoriteVenueGroup[] {
  const groups = new Map<string, ViewRow[]>();
  for (const row of rows) {
    const area = row.venue.sub || "Other";
    groups.set(area, [...(groups.get(area) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([area, groupRows]) => ({ area, rows: groupRows }))
    .sort((a, b) => areaLabel(a.area).localeCompare(areaLabel(b.area)));
}

export function areaLabel(area: string): string {
  return AREA_NAMES[area] ?? area;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function sortValue(row: ViewRow, sort: SortKey): string | number {
  switch (sort) {
    case "title":
      return row.venue.title;
    case "core":
      return RANK_ORDER[row.venue.rank.core || "N"] ?? 9;
    case "deadline":
    case "remaining":
      return row.deadline ? row.deadline.instant.getTime() : Number.MAX_SAFE_INTEGER;
  }
}

function remainingGroup(row: ViewRow): number {
  if (row.status === "upcoming") return 0;
  if (row.status === "closed") return 1;
  return 2;
}

function remainingSortTime(row: ViewRow, cycleAnchor: number): number {
  if (!row.deadline) return Number.MAX_SAFE_INTEGER;
  if (row.status === "closed") return projectedCycleTime(row.deadline.instant, cycleAnchor);
  return row.deadline.instant.getTime();
}
