import "./styles.css";
import { calendarFile } from "./calendar";
import { formatLocal, formatRemaining, latestUpcomingTime, nextDeadline, projectedCycleTime } from "./deadlines";
import { mountOrnament, type OrnamentHandle } from "./ornament";
import { AREA_NAMES, RANK_ORDER, type AcceptanceRate, type Dataset, type FavoriteLayout, type SortDirection, type SortKey, type StoredPreferences, type ThemeMode, type Venue, type ViewRow } from "./types";

const PREFERENCES_KEY = "cs-venues-table-preferences";
const FAVORITES_KEY = "cs-venues-favorites";
const LEGACY_PINS_KEY = "cs-venues-pins";

const state = {
  dataset: null as Dataset | null,
  now: new Date(),
  query: "",
  areas: [] as string[],
  coreRanks: ["A*", "A"],
  sort: "remaining" as SortKey,
  sortDirection: "asc" as SortDirection,
  theme: preferredTheme(),
  explicitTheme: false,
  favoriteVenues: new Set<string>(),
  favoriteLayout: "unified" as FavoriteLayout,
  favoriteCollapsed: false,
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

let ornament: OrnamentHandle | null = null;

hydrateFromUrl();
applyTheme();

app.innerHTML = `
  <div class="shell">
    <header class="site-header">
      <canvas id="headerOrnament" class="header-ornament" aria-hidden="true"></canvas>
      <button id="headerOrnamentPause" class="ornament-pause" type="button" aria-label="Pause background animation">⏸</button>
      <nav class="top-nav" aria-label="Primary navigation">
        <a class="brand" href="/">CS Venues</a>
        <div class="nav-actions">
          <a class="icon-button" href="https://github.com/changhoon-sung/cs-venues" target="_blank" rel="noreferrer" aria-label="GitHub repository" title="GitHub repository">${githubIcon()}</a>
          <button type="button" id="themeToggle" class="theme-toggle" aria-label="Theme: ${state.theme}" title="Theme: ${state.theme}">${themeIcon(state.theme)}</button>
        </div>
      </nav>
      <section class="hero">
        <div class="hero-copy">
          <h1><span class="desktop-title">Computer Science Venues</span><span class="mobile-title">CS Venues</span></h1>
          <p class="lede">
            A reference table of conference venues, CORE rankings, and submission deadlines.
            <span class="deadline-sentence">Deadline times are shown in the browser timezone.</span>
            <span class="author-note">Made by <a href="https://github.com/changhoon-sung" target="_blank" rel="noreferrer">@changhoon-sung</a>.</span>
          </p>
          <section class="references" aria-label="References">
            <h2>Sources</h2>
            <a href="https://github.com/ccfddl/ccf-deadlines" target="_blank" rel="noreferrer">CCFDDL dataset</a>
            <a href="https://portal.core.edu.au/conf-ranks/" target="_blank" rel="noreferrer">CORE conference ranks</a>
          </section>
        </div>
      </section>
    </header>

    <main>
      <section id="favoriteVenues" class="favorite-venues" aria-label="Favorite venues"></section>

      <section class="toolbar" aria-label="Filters">
        <label>
          Search
          <input id="query" type="search" placeholder="venue, description, area" />
        </label>
      </section>

      <section class="filter-groups" aria-label="Rank and area filters">
        <fieldset>
          <legend>Area</legend>
          <div id="areaFilters" class="check-grid"></div>
        </fieldset>
        <fieldset>
          <legend>CORE</legend>
          <div id="coreFilters" class="check-row"></div>
        </fieldset>
      </section>

      <section class="meta-line" aria-live="polite">
        <span id="summary">Loading...</span>
      </section>

      <section class="table-frame">
        <table>
          <colgroup>
            <col class="col-title" />
            <col class="col-deadline" />
            <col class="col-event" />
          </colgroup>
          <thead>
            <tr>
              <th><button type="button" data-sort="title">Venue</button></th>
              <th>
                <button type="button" data-sort="remaining">Deadline</button>
                <div id="timezone" class="th-note"></div>
              </th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </section>

    </main>
  </div>
`;

const controls = {
  query: mustGet<HTMLInputElement>("query"),
  themeToggle: mustGet<HTMLButtonElement>("themeToggle"),
  areaFilters: mustGet<HTMLElement>("areaFilters"),
  coreFilters: mustGet<HTMLElement>("coreFilters"),
  summary: mustGet<HTMLElement>("summary"),
  favoriteVenues: mustGet<HTMLElement>("favoriteVenues"),
  timezone: mustGet<HTMLElement>("timezone"),
  rows: mustGet<HTMLTableSectionElement>("rows"),
};

const headerOrnamentCanvas = document.getElementById("headerOrnament");
const headerOrnamentPause = document.getElementById("headerOrnamentPause");
if (headerOrnamentCanvas instanceof HTMLCanvasElement) {
  ornament = mountOrnament(headerOrnamentCanvas, {
    pauseButton:
      headerOrnamentPause instanceof HTMLButtonElement ? headerOrnamentPause : undefined,
  });
}

void initialize();

async function initialize(): Promise<void> {
  const response = await fetch("/data/conferences.json");
  if (!response.ok) {
    throw new Error(`Failed to load dataset: ${response.status}`);
  }
  state.dataset = (await response.json()) as Dataset;
  state.favoriteVenues = readStoredFavorites();
  populateCheckboxFilters();
  syncControls();
  bindEvents();
  render();
  window.setInterval(() => {
    state.now = new Date();
    renderRowsOnly();
    renderSortIndicators();
  }, 1000);
}

function mustGet<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

function hydrateFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const sortParam = params.get("sort");
  const stored = readStoredPreferences();
  state.query = params.get("q") ?? "";
  state.areas = params.has("area") ? parseListParam(params.get("area")) : stored.areas;
  state.coreRanks = params.has("core") ? parseRankParam(params.get("core"), ["A*", "A"]) : stored.coreRanks;
  state.sort = params.has("sort") ? parseSortKey(sortParam) : stored.sort;
  state.sortDirection = params.has("dir") && isSortKey(sortParam) ? parseSortDirection(params.get("dir")) : stored.sortDirection;
  state.favoriteLayout = stored.favoriteLayout;
  state.favoriteCollapsed = stored.favoriteCollapsed;
  const themeParam = parseThemeMode(params.get("theme"));
  state.explicitTheme = Boolean(themeParam);
  state.theme = themeParam ?? preferredTheme();
}

function parseSortKey(value: string | null): SortKey {
  if (isSortKey(value)) {
    return value;
  }
  return "remaining";
}

function isSortKey(value: string | null): value is SortKey {
  return value === "title" || value === "core" || value === "deadline" || value === "remaining";
}

function parseSortDirection(value: string | null): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

function parseThemeMode(value: string | null): ThemeMode | null {
  if (value === "light" || value === "dark") return value;
  return null;
}

function preferredTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

function encodeListParam(values: string[]): string {
  return values.length ? values.join(",") : "all";
}

function readStoredPreferences(): Required<StoredPreferences> {
  const defaults: Required<StoredPreferences> = {
    areas: [],
    coreRanks: ["A*", "A"],
    sort: "remaining",
    sortDirection: "asc",
    favoriteLayout: "unified",
    favoriteCollapsed: false,
  };

  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as StoredPreferences;
    const storedSort = parsed.sort ?? null;
    return {
      areas: Array.isArray(parsed.areas) ? parsed.areas.filter(isKnownArea) : defaults.areas,
      coreRanks: Array.isArray(parsed.coreRanks) ? parsed.coreRanks.filter(isKnownCoreRank) : defaults.coreRanks,
      sort: isSortKey(storedSort) ? storedSort : defaults.sort,
      sortDirection: parsed.sortDirection === "desc" ? "desc" : defaults.sortDirection,
      favoriteLayout: isFavoriteLayout(parsed.favoriteLayout) ? parsed.favoriteLayout : defaults.favoriteLayout,
      favoriteCollapsed: typeof parsed.favoriteCollapsed === "boolean" ? parsed.favoriteCollapsed : defaults.favoriteCollapsed,
    };
  } catch {
    return defaults;
  }
}

function writeStoredPreferences(): void {
  try {
    const preferences: StoredPreferences = {
      areas: state.areas,
      coreRanks: state.coreRanks,
      sort: state.sort,
      sortDirection: state.sortDirection,
      favoriteLayout: state.favoriteLayout,
      favoriteCollapsed: state.favoriteCollapsed,
    };
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage failures; URL state still keeps the app shareable.
  }
}

function isKnownArea(value: unknown): value is string {
  return typeof value === "string" && (value in AREA_NAMES);
}

function isKnownCoreRank(value: unknown): value is string {
  return typeof value === "string" && coreRankValues().includes(value);
}

function isFavoriteLayout(value: unknown): value is FavoriteLayout {
  return value === "unified" || value === "area";
}

function writeUrl(): void {
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

function populateCheckboxFilters(): void {
  if (!state.dataset) return;
  const areas = [...new Set(state.dataset.venues.map((venue) => venue.sub))].sort();
  controls.areaFilters.innerHTML = [
    checkboxTemplate("area", "all", "all", !state.areas.length),
    ...areas.map((area) => checkboxTemplate("area", area, AREA_NAMES[area] ?? area, state.areas.includes(area))),
  ].join("");
  controls.coreFilters.innerHTML = [
    checkboxTemplate("coreRank", "all", "all", !state.coreRanks.length),
    ...coreRankValues().map((rank) => checkboxTemplate("coreRank", rank, rank, state.coreRanks.includes(rank))),
  ].join("");
}

function checkboxTemplate(name: string, value: string, label: string, checked: boolean): string {
  return `
    <label class="check-pill">
      <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""} />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function coreRankValues(): string[] {
  return ["A*", "A", "B", "C", "N"];
}

function syncControls(): void {
  controls.query.value = state.query;
  controls.themeToggle.innerHTML = themeIcon(state.theme);
  controls.themeToggle.setAttribute("aria-label", `Theme: ${state.theme}`);
  controls.themeToggle.title = `Theme: ${state.theme}`;
  controls.timezone.textContent = `TZ: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  applyTheme();
}

function bindEvents(): void {
  controls.query.addEventListener("input", () => {
    state.query = controls.query.value;
    render();
  });

  controls.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    state.explicitTheme = true;
    syncControls();
    render();
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.explicitTheme) return;
    state.theme = preferredTheme();
    applyTheme();
    syncControls();
    render();
  });

  for (const container of [controls.areaFilters, controls.coreFilters]) {
    container.addEventListener("change", (event) => {
      const checkbox = (event.target as Element).closest<HTMLInputElement>("input[type='checkbox']");
      if (!checkbox) return;
      updateCheckboxState(checkbox.name as "area" | "coreRank", checkbox.value, checkbox.checked);
      populateCheckboxFilters();
      render();
    });
  }

  document.addEventListener("click", (event) => {
    const calendarButton = (event.target as Element).closest<HTMLButtonElement>("[data-calendar]");
    if (calendarButton) {
      downloadCalendarEvent(calendarButton.dataset.calendar ?? "");
      return;
    }
    const sortButton = (event.target as Element).closest<HTMLButtonElement>("[data-sort]");
    if (sortButton) {
      const nextSort = parseSortKey(sortButton.dataset.sort ?? null);
      state.sortDirection = state.sort === nextSort && state.sortDirection === "asc" ? "desc" : "asc";
      state.sort = nextSort;
      render();
      return;
    }
    const rankButton = (event.target as Element).closest<HTMLButtonElement>("[data-rank-filter]");
    if (rankButton) {
      const target = rankButton.dataset.rankTarget;
      const rank = rankButton.dataset.rankValue ?? "all";
      if (target === "core") state.coreRanks = [rank];
      populateCheckboxFilters();
      render();
      return;
    }
    const areaButton = (event.target as Element).closest<HTMLButtonElement>("[data-area-filter]");
    if (areaButton) {
      state.areas = [areaButton.dataset.areaFilter ?? ""].filter(Boolean);
      populateCheckboxFilters();
      render();
      return;
    }
    const favoriteButton = (event.target as Element).closest<HTMLButtonElement>("[data-favorite]");
    if (favoriteButton) {
      toggleFavoriteWithoutScrollJump(favoriteButton);
      return;
    }
    const favoriteLayoutButton = (event.target as Element).closest<HTMLButtonElement>("[data-favorite-layout]");
    if (favoriteLayoutButton) {
      state.favoriteLayout = favoriteLayoutButton.dataset.favoriteLayout === "area" ? "area" : "unified";
      render();
      return;
    }
    const favoriteHeader = (event.target as Element).closest<HTMLElement>("[data-favorite-collapse]");
    if (favoriteHeader) {
      state.favoriteCollapsed = !state.favoriteCollapsed;
      render();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const favoriteHeader = (event.target as Element).closest<HTMLElement>("[data-favorite-collapse]");
    if (!favoriteHeader) return;
    event.preventDefault();
    state.favoriteCollapsed = !state.favoriteCollapsed;
    render();
  });
}

function toggleFavorite(title: string): void {
  if (!title) return;
  if (state.favoriteVenues.has(title)) {
    state.favoriteVenues.delete(title);
  } else {
    state.favoriteVenues.add(title);
  }
  writeStoredFavorites();
}

function toggleFavoriteWithoutScrollJump(button: HTMLButtonElement): void {
  const title = button.dataset.favorite ?? "";
  const anchorTop = button.getBoundingClientRect().top;
  const anchorInMainRows = Boolean(button.closest("#rows"));
  toggleFavorite(title);
  render();

  if (!anchorInMainRows) return;
  const anchor = [...controls.rows.querySelectorAll<HTMLButtonElement>("[data-favorite]")]
    .find((item) => item.dataset.favorite === title);
  if (!anchor) return;
  const delta = anchor.getBoundingClientRect().top - anchorTop;
  if (delta) window.scrollBy(0, delta);
}

function readStoredFavorites(): Set<string> {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY) ?? window.localStorage.getItem(LEGACY_PINS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function writeStoredFavorites(): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favoriteVenues].sort()));
  } catch {
    // Favorites are progressive enhancement; the table remains usable without storage.
  }
}

function downloadCalendarEvent(title: string): void {
  if (!state.dataset || !title) return;
  const venue = state.dataset.venues.find((item) => item.title === title);
  if (!venue) return;
  const deadline = nextDeadline(venue, state.now);
  if (!deadline) return;

  const file = calendarFile(venue, deadline);
  const blob = new Blob([file.content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function themeIcon(theme: ThemeMode): string {
  if (theme === "light") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"></path>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.4A7.6 7.6 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4Z"></path>
    </svg>
  `;
}

function githubIcon(): string {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.63 5.47 7.7.4.07.55-.18.55-.39 0-.19-.01-.83-.01-1.5-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.15-.28-.15-.68-.52-.01-.53.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.21-3.64-.9-3.64-4 0-.88.31-1.6.82-2.17-.08-.2-.36-1.03.08-2.14 0 0 .67-.22 2.2.83A7.45 7.45 0 0 1 8 3.97c.68 0 1.36.09 2 .27 1.53-1.05 2.2-.83 2.2-.83.44 1.11.16 1.94.08 2.14.51.57.82 1.29.82 2.17 0 3.11-1.87 3.79-3.65 4 .29.25.54.75.54 1.52 0 1.1-.01 1.98-.01 2.25 0 .21.15.46.55.39A8.02 8.02 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z"></path>
    </svg>
  `;
}

function updateCheckboxState(name: "area" | "coreRank", value: string, checked: boolean): void {
  if (name === "area") {
    state.areas = updateValues(state.areas, value, checked);
    return;
  }
  state.coreRanks = updateValues(state.coreRanks, value, checked);
}

function updateValues(current: string[], value: string, checked: boolean): string[] {
  if (value === "all") return checked ? [] : current;
  const next = checked ? [...new Set([...current, value])] : current.filter((item) => item !== value);
  return next;
}

function applyTheme(): void {
  document.documentElement.dataset.theme = state.theme;
  ornament?.refreshColors();
}

function render(): void {
  renderRowsOnly();
  renderSortIndicators();
  writeUrl();
  writeStoredPreferences();
  requestAnimationFrame(() => ornament?.relayout());
}

function renderRowsOnly(): void {
  if (!state.dataset) return;
  const rows = filteredRows();

  controls.summary.textContent = rows.length
    ? `Showing ${rows.length} venues · ${state.dataset.venues.length} in CCFDDL`
    : `Showing 0 venues · ${state.dataset.venues.length} in CCFDDL`;

  renderFavoriteVenues();
  controls.rows.innerHTML = rows.map(rowTemplate).join("");
}

function renderFavoriteVenues(): void {
  if (!state.dataset) return;
  const favoriteRows = sortRows(state.dataset.venues
    .filter((venue) => state.favoriteVenues.has(venue.title))
    .map((venue) => {
      const deadline = nextDeadline(venue, state.now);
      return {
        venue,
        deadline,
        status: deadline ? (deadline.instant > state.now ? "upcoming" : "closed") : "unknown",
      } satisfies ViewRow;
    }));

  controls.favoriteVenues.hidden = favoriteRows.length === 0;
  controls.favoriteVenues.innerHTML = favoriteRows.length
    ? `
      <div class="favorite-header" data-favorite-collapse role="button" tabindex="0" aria-expanded="${state.favoriteCollapsed ? "false" : "true"}">
        <span class="favorite-collapse">
          <span class="favorite-collapse-icon" aria-hidden="true">${state.favoriteCollapsed ? "▸" : "▾"}</span>
          <span>Favorite venues</span>
          <span class="favorite-count">${favoriteRows.length}</span>
        </span>
        <span class="favorite-layout-toggle ${state.favoriteCollapsed ? "hidden" : ""}" aria-label="Favorite venue layout">
          <button type="button" class="${state.favoriteLayout === "unified" ? "active" : ""}" data-favorite-layout="unified">Unified</button>
          <button type="button" class="${state.favoriteLayout === "area" ? "active" : ""}" data-favorite-layout="area">Area</button>
        </span>
      </div>
      <div class="table-frame favorite-table-frame ${state.favoriteCollapsed ? "hidden" : ""}">
        <table>
          <colgroup>
            <col class="col-title" />
            <col class="col-deadline" />
            <col class="col-event" />
          </colgroup>
          <thead>
            <tr>
              <th><button type="button" data-sort="title">Venue</button></th>
              <th>
                <button type="button" data-sort="remaining">Deadline</button>
                <div class="th-note">TZ: ${escapeHtml(Intl.DateTimeFormat().resolvedOptions().timeZone)}</div>
              </th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody>${favoriteRowsTemplate(favoriteRows)}</tbody>
        </table>
      </div>
    `
    : "";
}

function favoriteRowsTemplate(rows: ViewRow[]): string {
  if (state.favoriteLayout !== "area") return rows.map(rowTemplate).join("");
  return groupedFavoriteRows(rows)
    .map(({ area, rows: areaRows }) => `
      <tr class="favorite-group-row">
        <td colspan="3">${escapeHtml(AREA_NAMES[area] ?? area)}</td>
      </tr>
      ${areaRows.map(rowTemplate).join("")}
    `)
    .join("");
}

function groupedFavoriteRows(rows: ViewRow[]): Array<{ area: string; rows: ViewRow[] }> {
  const groups = new Map<string, ViewRow[]>();
  for (const row of rows) {
    const area = row.venue.sub || "Other";
    groups.set(area, [...(groups.get(area) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([area, groupRows]) => ({ area, rows: groupRows }))
    .sort((a, b) => (AREA_NAMES[a.area] ?? a.area).localeCompare(AREA_NAMES[b.area] ?? b.area));
}

function filteredRows(): ViewRow[] {
  if (!state.dataset) return [];
  const query = state.query.trim().toLowerCase();
  return sortRows(state.dataset.venues
    .filter((venue) => rankMatches(venue.rank.core, state.coreRanks))
    .filter((venue) => !state.areas.length || state.areas.includes(venue.sub))
    .map((venue) => {
      const deadline = nextDeadline(venue, state.now);
      return {
        venue,
        deadline,
        status: deadline ? (deadline.instant > state.now ? "upcoming" : "closed") : "unknown",
      } satisfies ViewRow;
    })
    .filter((row) => !query || searchable(row.venue).includes(query)));
}

function searchable(venue: Venue): string {
  return [
    venue.title,
    venue.description,
    venue.sub,
    venue.rank.core,
    venue.rank.thcpl,
    venue.dblp,
  ].join(" ").toLowerCase();
}

function rankMatches(value: string | undefined, filter: string[]): boolean {
  const rank = value || "N";
  if (!filter.length) return true;
  return filter.includes(rank);
}

function sortRows(rows: ViewRow[]): ViewRow[] {
  const cycleAnchor = latestUpcomingTime(rows, state.now);
  return rows.sort((a, b) => compareRows(a, b, cycleAnchor));
}

function compareRows(a: ViewRow, b: ViewRow, cycleAnchor = state.now.getTime()): number {
  if (state.sort === "remaining") {
    return compareRemaining(a, b, cycleAnchor);
  }

  const sortValue = (row: ViewRow): string | number => {
    switch (state.sort) {
      case "title":
        return row.venue.title;
      case "core":
        return RANK_ORDER[row.venue.rank.core || "N"] ?? 9;
      case "deadline":
        return row.deadline ? row.deadline.instant.getTime() : Number.MAX_SAFE_INTEGER;
      default:
        return row.deadline ? row.deadline.instant.getTime() : Number.MAX_SAFE_INTEGER;
    }
  };
  const av = sortValue(a);
  const bv = sortValue(b);
  const direction = state.sortDirection === "asc" ? 1 : -1;
  if (typeof av === "number" || typeof bv === "number") return (Number(av) - Number(bv)) * direction;
  return av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true }) * direction;
}

function compareRemaining(a: ViewRow, b: ViewRow, cycleAnchor: number): number {
  const group = (row: ViewRow): number => {
    if (row.status === "upcoming") return 0;
    if (row.status === "closed") return 1;
    return 2;
  };
  const ag = group(a);
  const bg = group(b);
  if (ag !== bg) return ag - bg;

  const sortTime = (row: ViewRow): number => {
    if (!row.deadline) return Number.MAX_SAFE_INTEGER;
    if (row.status === "closed") return projectedCycleTime(row.deadline.instant, cycleAnchor);
    return row.deadline.instant.getTime();
  };
  const av = sortTime(a);
  const bv = sortTime(b);
  const direction = state.sortDirection === "asc" ? 1 : -1;
  return (av - bv) * direction;
}

function renderSortIndicators(): void {
  const labels: Record<SortKey, string> = {
    title: "Venue",
    core: "CORE",
    deadline: "Deadline",
    remaining: "Deadline",
  };

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-sort]")) {
    const key = parseSortKey(button.dataset.sort ?? null);
    const active = key === state.sort;
    button.classList.toggle("active", active);
    button.setAttribute("aria-sort", active ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none");
    button.innerHTML = `${labels[key]}<span class="sort-arrow" aria-hidden="true">${active ? (state.sortDirection === "asc" ? "↑" : "↓") : ""}</span>`;
  }
}

function rowTemplate(row: ViewRow): string {
  const { venue, deadline } = row;
  const conf = deadline?.conf ?? venue.confs[0];
  const localDeadline = deadline ? formatLocal(deadline.instant) : "N/A";
  const remaining = deadline ? formatRemaining(deadline.instant, state.now) : "N/A";
  const deadlineMeta = deadline ? `${deadline.kind} · ${conf?.timezone ?? ""}` : "N/A";
  const remainingClass = deadline && row.status === "upcoming" && deadline.instant.getTime() - state.now.getTime() < 2_592_000_000
    ? "soon"
    : "";
  const venueTitle = conf?.link
    ? `<a class="venue-link" href="${escapeHtml(conf.link)}" target="_blank" rel="noreferrer">${escapeHtml(venue.title)}</a>`
    : escapeHtml(venue.title);
  const favorite = state.favoriteVenues.has(venue.title);
  const note = deadline?.comment ? `<div class="venue-note">Note: ${escapeHtml(deadline.comment)}</div>` : "";
  const acceptanceRate = acceptanceRateTemplate(venue.acceptanceRate);
  const calendarButton = deadline && row.status === "upcoming"
    ? `<button type="button" class="calendar-button" data-calendar="${escapeHtml(venue.title)}" aria-label="Add ${escapeHtml(venue.title)} deadline to calendar" title="Add to calendar">${calendarIcon()}</button>`
    : "";
  return `
    <tr>
      <td>
        <div class="venue-head">
          <div class="venue-title">
            ${venueTitle}
            <button type="button" class="favorite ${favorite ? "active" : ""}" data-favorite="${escapeHtml(venue.title)}" aria-label="${favorite ? "Remove favorite" : "Add favorite"}" title="${favorite ? "Remove favorite" : "Add favorite"}">${starIcon()}</button>
          </div>
          <div class="venue-tags">
            <button type="button" class="area-label" data-area-filter="${escapeHtml(venue.sub)}">${escapeHtml(AREA_NAMES[venue.sub] ?? venue.sub)}</button>
            <button type="button" class="rank" data-rank-target="core" data-rank-filter data-rank-value="${escapeHtml(venue.rank.core || "N")}">CORE ${escapeHtml(venue.rank.core || "N")}</button>
            ${acceptanceRate}
          </div>
        </div>
        <div class="venue-desc">${escapeHtml(venue.description)}</div>
        ${note}
      </td>
      <td>
        <div class="deadline-cell">
          <div class="deadline-primary">
            <span class="remaining ${row.status} ${remainingClass}">${escapeHtml(remaining)}</span>
            ${calendarButton}
          </div>
          <div class="deadline-local">${escapeHtml(localDeadline)}</div>
          <div class="deadline-meta">${escapeHtml(deadlineMeta)}</div>
        </div>
      </td>
      <td>
        <div>${escapeHtml(conf?.date || "N/A")}</div>
        <div class="muted">${escapeHtml(conf?.place || "")}</div>
      </td>
    </tr>
  `;
}

function acceptanceRateTemplate(rate: AcceptanceRate | undefined): string {
  if (!rate || !Number.isFinite(rate.rate) || rate.rate <= 0) return "";
  const percent = `${(rate.rate * 100).toFixed(1)}%`;
  const label = `AR ${percent} ${rate.year}`;
  const title = `${percent} accepted (${rate.accepted}/${rate.submitted}) in ${rate.year}`;
  if (rate.source) {
    return `<a class="acceptance-rate" href="${escapeHtml(rate.source)}" target="_blank" rel="noreferrer" title="${escapeHtml(title)}">${escapeHtml(label)}</a>`;
  }
  return `<span class="acceptance-rate" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
}

function starIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8Z"></path>
    </svg>
  `;
}

function calendarIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 2v4M16 2v4M3.5 9h17M6 4h12a2.5 2.5 0 0 1 2.5 2.5v12A2.5 2.5 0 0 1 18 21H6a2.5 2.5 0 0 1-2.5-2.5v-12A2.5 2.5 0 0 1 6 4Z"></path>
    </svg>
  `;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}
