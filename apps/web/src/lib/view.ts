import type {
  ColumnView,
  DashboardView,
  DayCellView,
  DayForecast,
  DayRowView,
  ForecastPoint,
  MetricView,
  WeatherCondition,
  WeatherIconKey,
  WeatherSnapshot,
  WeekView,
} from './types';

/** Picks the sprite for a condition, splitting the sky-showing ones by day/night. */
export function pickIcon(condition: WeatherCondition, isDay: boolean): WeatherIconKey {
  switch (condition) {
    case 'clear':
      return isDay ? 'clear-day' : 'clear-night';
    case 'partly-cloudy':
      return isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
    case 'cloudy':
      return 'cloudy';
    case 'fog':
      return 'fog';
    case 'drizzle':
    case 'rain':
      return 'rain';
    case 'heavy-rain':
      return 'heavy-rain';
    case 'snow':
      return 'snow';
    case 'thunderstorm':
      return 'thunderstorm';
  }
}

/**
 * Always three columns and two metrics, whatever the payload contains — the
 * 720x720 grid is fixed, so a missing period leaves a placeholder rather than
 * collapsing the layout.
 */
export function toDashboardView(snapshot: WeatherSnapshot): DashboardView {
  return {
    location: snapshot.location.toUpperCase(),
    columns: [
      currentColumn(snapshot),
      forecastColumn('MIDDAY', find(snapshot, 'midday')),
      forecastColumn('EVENING', find(snapshot, 'evening')),
    ],
    metrics: metrics(snapshot),
    week: toWeekView(snapshot),
  };
}

function find(snapshot: WeatherSnapshot, period: ForecastPoint['period']) {
  return snapshot.forecast.find((point) => point.period === period) ?? null;
}

function currentColumn(snapshot: WeatherSnapshot): ColumnView {
  return {
    label: 'NOW',
    // The clock in the status bar already says what "now" is.
    time: '',
    icon: pickIcon(snapshot.conditionKey, snapshot.isDay),
    temperature: String(snapshot.temperature),
    condition: snapshot.condition.toUpperCase(),
  };
}

function forecastColumn(label: string, point: ForecastPoint | null): ColumnView {
  if (point === null) {
    return { label, time: '', icon: null, temperature: '--', condition: 'NO DATA' };
  }

  return {
    label,
    time: forecastTime(point),
    icon: pickIcon(point.conditionKey, point.isDay),
    temperature: String(point.temperature),
    condition: point.condition.toUpperCase(),
  };
}

/**
 * Late in the day a period can only be satisfied by tomorrow's forecast, which
 * would otherwise read as a wrong number for today.
 */
function forecastTime(point: ForecastPoint): string {
  const at = new Date(point.time);
  if (Number.isNaN(at.getTime())) return '';

  const clock = formatClock(at);
  return point.dayOffset > 0 ? `TMR ${clock}` : clock;
}

// --- The 7-day table ------------------------------------------------------

/** Dots in the rain meter of each row. */
const RAIN_DOTS = 4;

export function toWeekView(snapshot: WeatherSnapshot): WeekView {
  const rows = snapshot.week.map(dayRow);
  return { headings: headings(snapshot.week), rows };
}

/**
 * The hour each column stands for, read off the first row that actually has a
 * reading for it — the API fixes these hours, but the table should say what it
 * is showing rather than assert it.
 */
function headings(week: readonly DayForecast[]): string[] {
  const columns = week[0]?.periods.length ?? 0;
  const labels: string[] = [];

  for (let i = 0; i < columns; i += 1) {
    const point = week.map((day) => day.periods[i]).find((p) => p != null);
    labels.push(point === undefined ? '' : clockFromIso(point.time));
  }
  return labels;
}

function dayRow(day: DayForecast): DayRowView {
  return {
    key: day.date,
    weekday: weekdayOf(day.date),
    cells: day.periods.map(cell),
    rain: String(day.precipitationProbability),
    rainDots: rainDots(day.precipitationProbability),
  };
}

function cell(point: DayForecast['periods'][number]): DayCellView {
  if (point == null) return { icon: null, temperature: '--' };
  return {
    icon: pickIcon(point.conditionKey, point.isDay),
    temperature: String(point.temperature),
  };
}

/**
 * A coarse 4-step meter, so a glance across the column ranks the days without
 * anyone reading the numbers. Every band is at least one dot: the meter shows
 * how much rain is expected, and an empty row would read as missing data rather
 * than as a dry day. The percentage beside it carries the exact figure.
 */
function rainDots(probability: number): number {
  return Math.min(RAIN_DOTS, Math.floor(probability / 20) + 1);
}

/**
 * MON/TUE/... from a "YYYY-MM-DD" local date.
 *
 * Built through `Date.UTC` rather than `new Date(date)`: the latter reads a
 * bare date as UTC midnight and then reports it in the browser's zone, which
 * west of Greenwich lands on the previous day and shifts every label by one.
 */
function weekdayOf(date: string): string {
  const at = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  if (Number.isNaN(at)) return '';
  return WEEKDAYS[new Date(at).getUTCDay()] ?? '';
}

/**
 * 12-hour clock taken straight from the timestamp's own text.
 *
 * Not `new Date(...)` plus `formatClock`: the string already carries the
 * location's UTC offset, and going through `Date` re-expresses it in whatever
 * zone the browser is in. Those agree on the Pi and disagree on a laptop
 * elsewhere, and a column heading has to name the hour the forecast is for.
 */
function clockFromIso(iso: string): string {
  const hours = Number(iso.slice(11, 13));
  const minutes = iso.slice(14, 16);
  if (!Number.isInteger(hours) || minutes.length !== 2) return '';

  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${suffix}`;
}

function metrics(snapshot: WeatherSnapshot): MetricView[] {
  return [
    {
      label: 'RAIN CHANCE',
      value: String(snapshot.precipitationProbability),
      unit: '%',
      icon: 'umbrella',
    },
    {
      label: 'WIND',
      value: String(snapshot.windSpeed),
      unit: 'MPH',
      icon: 'wind',
    },
  ];
}

/** "JUST NOW", "1 MIN AGO", "12 MINS AGO", "2 HRS AGO". */
export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'RECENTLY';

  const minutes = Math.floor((now.getTime() - then) / 60_000);
  if (minutes <= 0) return 'JUST NOW';
  if (minutes === 1) return '1 MIN AGO';
  if (minutes < 60) return `${minutes} MINS AGO`;

  const hours = Math.floor(minutes / 60);
  return hours === 1 ? '1 HR AGO' : `${hours} HRS AGO`;
}

/** 12-hour wall clock without a leading zero, e.g. "1:05 AM". */
export function formatClock(now: Date): string {
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minutes} ${suffix}`;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

/**
 * "SAT 01 AUG". Hand-rolled rather than `Intl`, which would follow the
 * browser's locale and could hand back a lowercase or reordered string that
 * breaks the fixed-width status bar.
 */
export function formatDate(now: Date): string {
  const weekday = WEEKDAYS[now.getDay()] ?? '';
  const month = MONTHS[now.getMonth()] ?? '';
  return `${weekday} ${String(now.getDate()).padStart(2, '0')} ${month}`;
}
