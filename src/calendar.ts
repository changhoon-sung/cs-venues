import type { DeadlineHit, Venue } from "./types";

export function calendarFile(venue: Venue, deadline: DeadlineHit): { filename: string; content: string } {
  const end = new Date(deadline.instant.getTime() + 30 * 60_000);
  return {
    filename: `${slugify(`${venue.title}-${deadline.kind}-deadline`)}.ics`,
    content: calendarEventTemplate(venue, deadline, end),
  };
}

function calendarEventTemplate(venue: Venue, deadline: DeadlineHit, end: Date): string {
  const uid = `${slugify(venue.title)}-${deadline.kind}-${deadline.instant.toISOString()}@cs-venues`;
  const description = [
    venue.description,
    deadline.comment ? `Note: ${deadline.comment}` : "",
    deadline.conf.link ? `CFP: ${deadline.conf.link}` : "",
  ].filter(Boolean).join("\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CS Venues//Deadline Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(deadline.instant)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(`${venue.title} ${deadline.kind} deadline`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    deadline.conf.place ? `LOCATION:${escapeIcs(deadline.conf.place)}` : "",
    deadline.conf.link ? `URL:${escapeIcs(deadline.conf.link)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].filter((line) => line !== "").join("\r\n");
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deadline";
}
