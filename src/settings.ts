import { normalizeStoredPreferences } from "./storage";
import type { StoredPreferences } from "./types";

const SETTINGS_APP_ID = "cs-venues";
const SETTINGS_VERSION = 1;

export type SettingsExport = {
  app: typeof SETTINGS_APP_ID;
  kind: "settings";
  version: typeof SETTINGS_VERSION;
  exportedAt: string;
  preferences: Required<StoredPreferences>;
  favorites: string[];
};

export function serializeStorageSettings(preferences: StoredPreferences, favorites: Iterable<string>): string {
  return `${JSON.stringify(buildStorageSettings(preferences, favorites), null, 2)}\n`;
}

export function parseStorageSettings(text: string): SettingsExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Settings text is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Settings must be a JSON object.");
  }
  const settings = parsed as Partial<SettingsExport>;
  if (settings.app !== SETTINGS_APP_ID || settings.version !== SETTINGS_VERSION) {
    throw new Error("Settings are not a supported CS Venues v1 export.");
  }
  if (settings.kind && settings.kind !== "settings") {
    throw new Error("Settings export has an unsupported kind.");
  }
  return {
    app: SETTINGS_APP_ID,
    kind: "settings",
    version: SETTINGS_VERSION,
    exportedAt: typeof settings.exportedAt === "string" ? settings.exportedAt : new Date().toISOString(),
    preferences: normalizeStoredPreferences(settings.preferences),
    favorites: Array.isArray(settings.favorites)
      ? settings.favorites.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function settingsFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `cs-venues-settings-${date}.json`;
}

function buildStorageSettings(preferences: StoredPreferences, favorites: Iterable<string>): SettingsExport {
  return {
    app: SETTINGS_APP_ID,
    kind: "settings",
    version: SETTINGS_VERSION,
    exportedAt: new Date().toISOString(),
    preferences: normalizeStoredPreferences(preferences),
    favorites: [...favorites].sort(),
  };
}
