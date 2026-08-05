/**
 * Turning Google's free-text event timing into instants.
 *
 * SerpApi hands back strings written for a person to read — `"Sat, Aug 8, 7 –
 * 10 PM"`, `"Aug 8 – 10"`, `"Today, 7 PM"` — with no year and no timezone. This
 * file makes a best effort at an instant and **returns undefined the moment it
 * is unsure**, which is the whole design: `SourceEvent.when` carries the
 * original string and is always shown, so a failure here costs a sort key and
 * a Today/This-Week filter, never the event itself.
 *
 * **Unverified against real SerpApi payloads.** The engine has returned nothing
 * since 2026-08-04, so the formats below are taken from SerpApi's documentation
 * and from Google's own rendering, not from a captured response. Phase 0 in
 * `docs/events-map-plan.md` exists to check them, and this is the file most
 * likely to need correcting when it does.
 *
 * Nothing here invents a time. An event with a date and no clock time is
 * anchored to local midnight and flagged by `hasTime: false`, so the screen can
 * say "Sat 8 Aug" rather than "Sat 8 Aug, 12:00 AM".
 */

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export interface ParsedEventDate {
  /** ISO 8601 instant. */
  readonly startsAt: string;
  readonly endsAt?: string;
  /** False when only a date was found and midnight was assumed. */
  readonly hasTime: boolean;
}

/**
 * Best effort at when an event starts, in the dashboard's timezone.
 *
 * `nowMs` is passed rather than read so the year inference is testable and so
 * a Pi with a wrong clock fails the same way in tests as in life.
 */
export function parseEventDate(
  input: { readonly when?: string | undefined; readonly startDate?: string | undefined },
  timeZone: string,
  nowMs: number,
): ParsedEventDate | undefined {
  const text = [input.when, input.startDate].filter(isNonEmpty).join(' , ');
  if (text === '') return undefined;

  const day = findMonthAndDay(text, timeZone, nowMs);
  if (day === undefined) return undefined;

  const times = findTimes(text);
  const year = inferYear(day.month, day.day, timeZone, nowMs);

  const startsAtMs = zonedToUtc(
    { year, month: day.month, day: day.day, hour: times?.start.hour ?? 0, minute: times?.start.minute ?? 0 },
    timeZone,
  );

  let endsAtMs: number | undefined;
  if (times?.end !== undefined) {
    endsAtMs = zonedToUtc(
      { year, month: day.month, day: day.day, hour: times.end.hour, minute: times.end.minute },
      timeZone,
    );
    // "10 PM – 1 AM" ends on the following day.
    if (endsAtMs <= startsAtMs) endsAtMs += 24 * 60 * 60 * 1000;
  }

  return {
    startsAt: new Date(startsAtMs).toISOString(),
    ...(endsAtMs === undefined ? {} : { endsAt: new Date(endsAtMs).toISOString() }),
    hasTime: times !== undefined,
  };
}

/**
 * Month and day, from a month name or from the words "today"/"tomorrow".
 *
 * Only the *first* date in the string is taken. A range like "Aug 8 – 10"
 * therefore starts on the 8th, which is right: the end of a multi-day run is
 * not something this screen shows.
 */
function findMonthAndDay(
  text: string,
  timeZone: string,
  nowMs: number,
): { month: number; day: number } | undefined {
  const lower = text.toLowerCase();

  if (/\btoday\b/.test(lower)) {
    const parts = zonedParts(nowMs, timeZone);
    return { month: parts.month, day: parts.day };
  }
  if (/\btomorrow\b/.test(lower)) {
    const parts = zonedParts(nowMs + 24 * 60 * 60 * 1000, timeZone);
    return { month: parts.month, day: parts.day };
  }

  // "Aug 8" and "8 Aug" both occur; month name first is what Google writes.
  const monthFirst = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/.exec(lower);
  if (monthFirst?.[1] !== undefined && monthFirst[2] !== undefined) {
    const month = MONTHS[monthFirst[1]];
    if (month !== undefined) return { month, day: Number(monthFirst[2]) };
  }

  const dayFirst = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/.exec(lower);
  if (dayFirst?.[1] !== undefined && dayFirst[2] !== undefined) {
    const month = MONTHS[dayFirst[2]];
    if (month !== undefined) return { month, day: Number(dayFirst[1]) };
  }

  return undefined;
}

/**
 * Start and optional end clock times.
 *
 * Google writes ranges with an en dash and often states the meridiem once, at
 * the end: `"7 – 10 PM"` means 7 PM, not 7 AM. That inheritance is the whole
 * reason this is not a one-line regex.
 */
function findTimes(
  text: string,
): { start: { hour: number; minute: number }; end?: { hour: number; minute: number } } | undefined {
  const pattern = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi;

  const found: { hour: number; minute: number; meridiem: string | undefined }[] = [];
  for (const match of text.matchAll(pattern)) {
    const hour = Number(match[1]);
    // A bare number with no meridiem and no colon is a day-of-month, not a
    // time. Requiring one or the other is what keeps "Aug 8" out of here.
    if (match[2] === undefined && match[3] === undefined) continue;
    if (hour < 1 || hour > 23) continue;

    found.push({
      hour,
      minute: match[2] === undefined ? 0 : Number(match[2]),
      meridiem: match[3]?.toLowerCase(),
    });
    if (found.length === 2) break;
  }

  const start = found[0];
  if (start === undefined) return undefined;

  const end = found[1];
  // The trailing meridiem governs both ends of a range when the first omits it.
  const governing = start.meridiem ?? end?.meridiem;

  const result = {
    start: { hour: to24(start.hour, governing), minute: start.minute },
    ...(end === undefined
      ? {}
      : { end: { hour: to24(end.hour, end.meridiem ?? governing), minute: end.minute } }),
  };
  return result;
}

function to24(hour: number, meridiem: string | undefined): number {
  if (meridiem === 'pm') return hour === 12 ? 12 : Math.min(hour + 12, 23);
  if (meridiem === 'am') return hour === 12 ? 0 : hour;
  return hour;
}

/**
 * Which year a bare "Aug 8" means.
 *
 * Google omits the year because it is always near. Taking the current year and
 * rolling forward when that would be more than a month in the past handles the
 * December-to-January case without ever pushing a genuinely recent event a year
 * out. The window only ever looks a week ahead, so a wrong guess here is
 * self-correcting on the next refresh.
 */
function inferYear(month: number, day: number, timeZone: string, nowMs: number): number {
  const now = zonedParts(nowMs, timeZone);
  const candidate = Date.UTC(now.year, month - 1, day);
  const today = Date.UTC(now.year, now.month - 1, now.day);
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  if (candidate < today - THIRTY_DAYS) return now.year + 1;
  return now.year;
}

/** Wall-clock fields in a zone, to the UTC instant they name. */
function zonedToUtc(
  fields: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): number {
  const asUtc = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute);
  // Two passes, same as `startOfLocalDay` in history.ts: the first offset is
  // measured at the wrong instant, the second at very nearly the right one.
  const approximate = asUtc - offsetAt(asUtc, timeZone);
  return asUtc - offsetAt(approximate, timeZone);
}

/** Wall-clock fields as that zone reads them at a given instant. */
function zonedParts(
  atMs: number,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const found: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(atMs))) {
    if (part.type !== 'literal') found[part.type] = Number(part.value);
  }

  return {
    year: found['year'] ?? 1970,
    month: found['month'] ?? 1,
    day: found['day'] ?? 1,
    // Some ICU builds render midnight as hour 24 under hour12: false.
    hour: (found['hour'] ?? 0) % 24,
    minute: found['minute'] ?? 0,
    second: found['second'] ?? 0,
  };
}

/** How far ahead of UTC the zone was at that instant, in milliseconds. */
function offsetAt(atMs: number, timeZone: string): number {
  const parts = zonedParts(atMs, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(atMs / 1000) * 1000;
}

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/** Whether an instant falls on today's calendar date in the given zone. */
export function isSameLocalDay(aMs: number, bMs: number, timeZone: string): boolean {
  const a = zonedParts(aMs, timeZone);
  const b = zonedParts(bMs, timeZone);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
