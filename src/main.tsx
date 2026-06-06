import "./styles.css";
import { render } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { calendarFile } from "./calendar";
import { nextDeadline } from "./deadlines";
import { FavoriteVenues } from "./components/FavoriteVenues";
import { GithubIcon, SettingsIcon, ThemeIcon } from "./components/icons";
import { closedSettingsDialog, SettingsDialog, type SettingsDialogMode, type SettingsDialogState } from "./components/SettingsDialog";
import { VenueTable } from "./components/VenueTable";
import { mountOrnament, type OrnamentHandle } from "./ornament";
import { parseStorageSettings, serializeStorageSettings, settingsFilename, type SettingsExport } from "./settings";
import { readStoredFavorites, writeStoredFavorites, writeStoredPreferences } from "./storage";
import { AREA_NAMES, type Dataset, type FavoriteLayout, type SortDirection, type SortKey, type ThemeMode } from "./types";
import { currentStoredPreferences, preferredTheme, readInitialUiState, writeUrl } from "./url-state";
import { favoriteRows, filteredRows } from "./venue-view-model";

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("Missing #app root");
}

render(<App />, root);

function App() {
  const initial = useMemo(() => readInitialUiState(), []);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState(initial.query);
  const [areas, setAreas] = useState<string[]>(initial.areas);
  const [coreRanks, setCoreRanks] = useState<string[]>(initial.coreRanks);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initial.sortDirection);
  const [theme, setTheme] = useState<ThemeMode>(initial.theme);
  const [explicitTheme, setExplicitTheme] = useState(initial.explicitTheme);
  const [favoriteVenues, setFavoriteVenues] = useState<Set<string>>(() => readStoredFavorites());
  const [favoriteLayout, setFavoriteLayout] = useState<FavoriteLayout>(initial.favoriteLayout);
  const [favoriteCollapsed, setFavoriteCollapsed] = useState(initial.favoriteCollapsed);
  const [matrixPaused, setMatrixPaused] = useState(initial.matrixPaused);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState<SettingsDialogState>(() => closedSettingsDialog());
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const settingsFileInputRef = useRef<HTMLInputElement>(null);
  const settingsDialogRef = useRef<HTMLDialogElement>(null);
  const settingsTextRef = useRef<HTMLTextAreaElement>(null);
  const rowsRef = useRef<HTMLTableSectionElement>(null);
  const ornamentCanvasRef = useRef<HTMLCanvasElement>(null);
  const ornamentPauseRef = useRef<HTMLButtonElement>(null);
  const ornamentRef = useRef<OrnamentHandle | null>(null);

  const storedPreferences = currentStoredPreferences({
    areas,
    coreRanks,
    sort,
    sortDirection,
    favoriteLayout,
    favoriteCollapsed,
    matrixPaused,
  });
  const rows = useMemo(
    () => dataset ? filteredRows({ dataset, now, query, areas, coreRanks, sort, sortDirection }) : [],
    [dataset, now, query, areas, coreRanks, sort, sortDirection],
  );
  const favoriteVenueRows = useMemo(
    () => dataset ? favoriteRows({ dataset, now, favoriteVenues, sort, sortDirection }) : [],
    [dataset, now, favoriteVenues, sort, sortDirection],
  );
  const areaOptions = useMemo(
    () => dataset ? [...new Set(dataset.venues.map((venue) => venue.sub))].sort() : [],
    [dataset],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadDataset(controller.signal).then(setDataset).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    const rootElement = document.documentElement;
    rootElement.dataset.theme = theme;
    ornamentRef.current?.refreshColors();
  }, [theme]);

  useEffect(() => {
    writeUrl({ query, areas, coreRanks, sort, sortDirection, explicitTheme, theme });
    writeStoredPreferences(storedPreferences);
    window.requestAnimationFrame(() => ornamentRef.current?.relayout());
  }, [query, areas, coreRanks, sort, sortDirection, explicitTheme, theme, favoriteLayout, favoriteCollapsed, matrixPaused]);

  useEffect(() => {
    const onThemePreferenceChange = () => {
      if (explicitTheme) return;
      setTheme(preferredTheme());
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onThemePreferenceChange);
    return () => media.removeEventListener("change", onThemePreferenceChange);
  }, [explicitTheme]);

  useEffect(() => {
    const canvas = ornamentCanvasRef.current;
    if (!canvas) return;
    ornamentRef.current?.destroy();
    ornamentRef.current = mountOrnament(canvas, {
      pauseButton: ornamentPauseRef.current ?? undefined,
      paused: matrixPaused,
      onPausedChange(paused) {
        // Persisted by the writeUrl effect, which has matrixPaused in its deps.
        setMatrixPaused(paused);
      },
    });
    return () => {
      ornamentRef.current?.destroy();
      ornamentRef.current = null;
    };
  }, []);

  useEffect(() => {
    ornamentRef.current?.setPaused(matrixPaused);
  }, [matrixPaused]);

  useEffect(() => {
    const dialog = settingsDialogRef.current;
    if (!dialog) return;
    if (settingsDialog.open && !dialog.open) dialog.showModal();
    if (!settingsDialog.open && dialog.open) dialog.close();
    if (!settingsDialog.open) return;
    window.requestAnimationFrame(() => {
      settingsTextRef.current?.focus();
      if (settingsDialog.mode === "export") settingsTextRef.current?.select();
    });
  }, [settingsDialog.open, settingsDialog.mode]);

  useEffect(() => {
    if (!dataMenuOpen) return;
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".data-menu-wrap")) return;
      setDataMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDataMenuOpen(false);
    };
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dataMenuOpen]);

  function openSettingsDialog(mode: SettingsDialogMode, text = "") {
    setDataMenuOpen(false);
    setSettingsDialog({
      open: true,
      mode,
      text,
      help: mode === "export"
        ? "Copy the settings JSON or save it as a file."
        : "Paste a CS Venues settings JSON, then import it.",
      error: "",
      success: false,
    });
  }

  function closeSettingsDialog() {
    setSettingsDialog((dialog) => ({ ...dialog, open: false }));
  }

  function showSettingsError(message: string) {
    setSettingsDialog((dialog) => ({ ...dialog, error: message, success: false }));
  }

  function showSettingsSuccess(message: string) {
    setSettingsDialog((dialog) => ({ ...dialog, help: message, success: true, error: "" }));
  }

  async function copySettingsText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showSettingsSuccess("Copied settings JSON to clipboard.");
    } catch {
      showSettingsError("Clipboard copy failed. Select the text and copy it manually.");
    }
  }

  async function saveSettingsFile(text: string): Promise<void> {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const filename = settingsFilename();
    const pickerWindow = window as SaveFilePickerWindow;
    if (pickerWindow.showSaveFilePicker) {
      try {
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: "JSON files",
            accept: { "application/json": [".json"] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        showSettingsSuccess("Saved settings file.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showSettingsError("Could not open the save dialog. Downloading instead.");
      }
    }
    downloadBlob(blob, filename);
  }

  async function importSelectedSettingsFile(): Promise<void> {
    const input = settingsFileInputRef.current;
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (!file) return;
    const text = await file.text();
    try {
      applyStorageSettings(parseStorageSettings(text));
      closeSettingsDialog();
    } catch (error) {
      openSettingsDialog("import", text);
      showSettingsError(error instanceof Error ? error.message : "Failed to read settings file.");
    }
  }

  function importSettingsText(text: string): void {
    try {
      applyStorageSettings(parseStorageSettings(text));
      closeSettingsDialog();
    } catch (error) {
      showSettingsError(error instanceof Error ? error.message : "Invalid settings file.");
    }
  }

  function applyStorageSettings(settings: SettingsExport): void {
    const preferences = settings.preferences;
    setAreas(preferences.areas);
    setCoreRanks(preferences.coreRanks);
    setSort(preferences.sort);
    setSortDirection(preferences.sortDirection);
    setFavoriteLayout(preferences.favoriteLayout);
    setFavoriteCollapsed(preferences.favoriteCollapsed);
    setMatrixPaused(preferences.matrixPaused);
    const nextFavorites = new Set(knownFavoriteTitles(dataset, settings.favorites));
    setFavoriteVenues(nextFavorites);
    writeStoredFavorites(nextFavorites);
  }

  function toggleFavorite(title: string): void {
    if (!title) return;
    setFavoriteVenues((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      writeStoredFavorites(next);
      return next;
    });
  }

  function toggleFavoriteWithScroll(title: string, button: HTMLButtonElement, anchorInMainRows: boolean): void {
    const anchorTop = button.getBoundingClientRect().top;
    toggleFavorite(title);
    if (!anchorInMainRows) return;
    window.requestAnimationFrame(() => {
      const anchor = [...(rowsRef.current?.querySelectorAll<HTMLButtonElement>("[data-favorite]") ?? [])]
        .find((item) => item.dataset.favorite === title);
      if (!anchor) return;
      const delta = anchor.getBoundingClientRect().top - anchorTop;
      if (delta) window.scrollBy(0, delta);
    });
  }

  function updateSort(nextSort: SortKey): void {
    setSortDirection(sort === nextSort && sortDirection === "asc" ? "desc" : "asc");
    setSort(nextSort);
  }

  function updateValues(current: string[], value: string, checked: boolean): string[] {
    if (value === "all") return checked ? [] : current;
    return checked ? [...new Set([...current, value])] : current.filter((item) => item !== value);
  }

  function downloadCalendarEvent(title: string): void {
    if (!dataset || !title) return;
    const venue = dataset.venues.find((item) => item.title === title);
    if (!venue) return;
    const deadline = nextDeadline(venue, now);
    if (!deadline) return;
    const file = calendarFile(venue, deadline);
    downloadBlob(new Blob([file.content], { type: "text/calendar;charset=utf-8" }), file.filename);
  }

  return (
    <>
      <div class="shell">
        <header class="site-header">
          <canvas ref={ornamentCanvasRef} id="headerOrnament" class="header-ornament" aria-hidden="true" />
          <button ref={ornamentPauseRef} id="headerOrnamentPause" class="ornament-pause" type="button" aria-label="Pause background animation">⏸</button>
          <nav class="top-nav" aria-label="Primary navigation">
            <a class="brand" href="/">CS Venues</a>
            <div class="nav-actions">
              <div class="data-menu-wrap">
                <button
                  type="button"
                  id="dataMenuToggle"
                  class="icon-button"
                  aria-label="Settings"
                  title="Settings"
                  aria-expanded={dataMenuOpen ? "true" : "false"}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDataMenuOpen((open) => !open);
                  }}
                >
                  <SettingsIcon />
                </button>
                <div id="dataMenu" class="data-menu" hidden={!dataMenuOpen}>
                  <button type="button" onClick={() => openSettingsDialog("export", serializeStorageSettings(storedPreferences, favoriteVenues))}>Export settings...</button>
                  <button type="button" onClick={() => openSettingsDialog("import")}>Import settings...</button>
                </div>
              </div>
              <a class="icon-button" href="https://github.com/changhoon-sung/cs-venues" target="_blank" rel="noreferrer" aria-label="GitHub repository" title="GitHub repository">
                <GithubIcon />
              </a>
              <button
                type="button"
                id="themeToggle"
                class="theme-toggle"
                aria-label={`Theme: ${theme}`}
                title={`Theme: ${theme}`}
                onClick={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  setExplicitTheme(true);
                }}
              >
                <ThemeIcon theme={theme} />
              </button>
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
          <FavoriteVenues
            rows={favoriteVenueRows}
            collapsed={favoriteCollapsed}
            layout={favoriteLayout}
            timezone={timezone}
            sort={sort}
            sortDirection={sortDirection}
            now={now}
            favoriteVenues={favoriteVenues}
            onToggleCollapse={() => setFavoriteCollapsed((collapsed) => !collapsed)}
            onLayoutChange={setFavoriteLayout}
            onSort={updateSort}
            onAreaFilter={(area) => setAreas([area].filter(Boolean))}
            onRankFilter={(rank) => setCoreRanks([rank])}
            onToggleFavorite={(title, button) => toggleFavoriteWithScroll(title, button, false)}
            onCalendar={downloadCalendarEvent}
          />

          <section class="toolbar" aria-label="Filters">
            <label>
              Search
              <input id="query" type="search" placeholder="venue, description, area" value={query} onInput={(event) => setQuery(event.currentTarget.value)} />
            </label>
          </section>

          <section class="filter-groups" aria-label="Rank and area filters">
            <fieldset>
              <legend>Area</legend>
              <div id="areaFilters" class="check-grid">
                <CheckboxPill name="area" value="all" label="all" checked={!areas.length} onChange={(checked) => setAreas(updateValues(areas, "all", checked))} />
                {areaOptions.map((area) => (
                  <CheckboxPill key={area} name="area" value={area} label={AREA_NAMES[area] ?? area} checked={areas.includes(area)} onChange={(checked) => setAreas(updateValues(areas, area, checked))} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>CORE</legend>
              <div id="coreFilters" class="check-row">
                <CheckboxPill name="coreRank" value="all" label="all" checked={!coreRanks.length} onChange={(checked) => setCoreRanks(updateValues(coreRanks, "all", checked))} />
                {coreRankValues().map((rank) => (
                  <CheckboxPill key={rank} name="coreRank" value={rank} label={rank} checked={coreRanks.includes(rank)} onChange={(checked) => setCoreRanks(updateValues(coreRanks, rank, checked))} />
                ))}
              </div>
            </fieldset>
          </section>

          <section class="meta-line" aria-live="polite">
            <span id="summary">
              {dataset ? `Showing ${rows.length} venues · ${dataset.venues.length} in CCFDDL` : "Loading..."}
            </span>
          </section>

          <VenueTable
            rows={rows}
            rowsRef={rowsRef}
            timezone={timezone}
            sort={sort}
            sortDirection={sortDirection}
            now={now}
            favoriteVenues={favoriteVenues}
            onSort={updateSort}
            onAreaFilter={(area) => setAreas([area].filter(Boolean))}
            onRankFilter={(rank) => setCoreRanks([rank])}
            onToggleFavorite={(title, button) => toggleFavoriteWithScroll(title, button, true)}
            onCalendar={downloadCalendarEvent}
          />
        </main>
      </div>

      <input ref={settingsFileInputRef} id="settingsFileInput" class="visually-hidden" type="file" accept="application/json,.json" aria-label="Import settings file" onChange={() => void importSelectedSettingsFile()} />
      <SettingsDialog
        dialogRef={settingsDialogRef}
        textRef={settingsTextRef}
        dialog={settingsDialog}
        onTextChange={(text) => setSettingsDialog((dialog) => ({ ...dialog, text }))}
        onClose={closeSettingsDialog}
        onImportFile={() => settingsFileInputRef.current?.click()}
        onCopy={() => void copySettingsText(settingsDialog.text)}
        onSave={() => void saveSettingsFile(settingsDialog.text)}
        onImport={() => importSettingsText(settingsDialog.text)}
      />
    </>
  );
}

async function loadDataset(signal: AbortSignal): Promise<Dataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/conferences.json`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load dataset: ${response.status}`);
  }
  return (await response.json()) as Dataset;
}

function knownFavoriteTitles(dataset: Dataset | null, favorites: string[]): string[] {
  if (!dataset) return favorites;
  const known = new Set(dataset.venues.map((venue) => venue.title));
  return favorites.filter((title) => known.has(title));
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function coreRankValues(): string[] {
  return ["A*", "A", "B", "C", "N"];
}

function CheckboxPill(props: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label class="check-pill">
      <input type="checkbox" name={props.name} value={props.value} checked={props.checked} onChange={(event) => props.onChange(event.currentTarget.checked)} />
      <span>{props.label}</span>
    </label>
  );
}
