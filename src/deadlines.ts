import type { DeadlineHit, Venue, ViewRow } from "./types";

export function nextDeadline(venue: Venue, now: Date): DeadlineHit | null {
  const hits: DeadlineHit[] = [];
  for (const conf of venue.confs) {
    for (const item of conf.timeline || []) {
      if (item.abstract_deadline) {
        const instant = parseDeadline(item.abstract_deadline, conf.timezone);
        if (instant) hits.push({ kind: "abstract", value: item.abstract_deadline, instant, conf, comment: item.comment });
      }
      if (item.deadline) {
        const instant = parseDeadline(item.deadline, conf.timezone);
        if (instant) hits.push({ kind: "deadline", value: item.deadline, instant, conf, comment: item.comment });
      }
    }
  }
  const upcoming = hits.filter((hit) => hit.instant > now).sort((a, b) => a.instant.getTime() - b.instant.getTime());
  if (upcoming[0]) return upcoming[0];
  return hits.sort((a, b) => b.instant.getTime() - a.instant.getTime())[0] ?? null;
}

export function latestUpcomingTime(rows: ViewRow[], now: Date): number {
  const upcomingTimes = rows
    .filter((row) => row.status === "upcoming" && row.deadline)
    .map((row) => row.deadline!.instant.getTime());
  return upcomingTimes.length ? Math.max(...upcomingTimes) : now.getTime();
}

export function projectedCycleTime(date: Date, anchor: number): number {
  const anchorDate = new Date(anchor);
  let projected = new Date(
    anchorDate.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  if (projected.getTime() <= anchor) {
    projected = new Date(
      anchorDate.getFullYear() + 1,
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    );
  }
  return projected.getTime();
}

export function formatLocal(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatRemaining(date: Date, now: Date): string {
  let seconds = Math.floor((date.getTime() - now.getTime()) / 1000);
  if (seconds <= 0) return "closed";
  const pad2 = (value: number) => String(value).padStart(2, " ");
  const months = Math.floor(seconds / 2_592_000);
  seconds -= months * 2_592_000;
  const days = Math.floor(seconds / 86_400);
  seconds -= days * 86_400;
  const hours = Math.floor(seconds / 3_600);
  seconds -= hours * 3_600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  return `${months}mo ${pad2(days)}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
}

function parseDeadline(value: string, timezone: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const utc = Date.UTC(year, month - 1, day, hour, minute, second) - timezoneOffsetMinutes(timezone) * 60_000;
  return new Date(utc);
}

function timezoneOffsetMinutes(timezone: string): number {
  if (/aoe/i.test(timezone)) return -12 * 60;
  const match = timezone.match(/UTC\s*([+-])?\s*(\d{1,2})?(?::?(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2] ?? "0") * 60 + Number(match[3] ?? "0"));
}
