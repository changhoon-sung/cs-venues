import type { ThemeMode } from "../types";

export function ThemeIcon({ theme }: { theme: ThemeMode }) {
  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.4A7.6 7.6 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4Z" />
    </svg>
  );
}

export function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.63 5.47 7.7.4.07.55-.18.55-.39 0-.19-.01-.83-.01-1.5-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.15-.28-.15-.68-.52-.01-.53.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.21-3.64-.9-3.64-4 0-.88.31-1.6.82-2.17-.08-.2-.36-1.03.08-2.14 0 0 .67-.22 2.2.83A7.45 7.45 0 0 1 8 3.97c.68 0 1.36.09 2 .27 1.53-1.05 2.2-.83 2.2-.83.44 1.11.16 1.94.08 2.14.51.57.82 1.29.82 2.17 0 3.11-1.87 3.79-3.65 4 .29.25.54.75.54 1.52 0 1.1-.01 1.98-.01 2.25 0 .21.15.46.55.39A8.02 8.02 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8Z" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 2v4M16 2v4M3.5 9h17M6 4h12a2.5 2.5 0 0 1 2.5 2.5v12A2.5 2.5 0 0 1 18 21H6a2.5 2.5 0 0 1-2.5-2.5v-12A2.5 2.5 0 0 1 6 4Z" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <path d="M4 12h3" />
      <path d="M11 12h9" />
      <path d="M4 17h12" />
      <path d="M20 17h0" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="18" cy="17" r="2" />
    </svg>
  );
}
