import type { DashboardView, WeatherIconKey, WeatherSnapshot } from './types';

/** Picks the sprite for a condition, splitting clear skies by day/night. */
export function pickIcon(snapshot: WeatherSnapshot): WeatherIconKey {
  switch (snapshot.conditionKey) {
    case 'clear':
      return snapshot.isDay ? 'clear-day' : 'clear-night';
    case 'partly-cloudy':
      return 'partly-cloudy';
    case 'cloudy':
      return 'cloudy';
    case 'fog':
      return 'fog';
    case 'drizzle':
    case 'rain':
      return 'rain';
    case 'snow':
      return 'snow';
    case 'thunderstorm':
      return 'thunderstorm';
  }
}

export function toDashboardView(
  snapshot: WeatherSnapshot,
  now: Date,
): DashboardView {
  return {
    location: snapshot.location.toUpperCase(),
    icon: pickIcon(snapshot),
    temperature: `${snapshot.temperature}°`,
    condition: snapshot.condition.toUpperCase(),
    feelsLike: `FEELS ${snapshot.apparentTemperature}°`,
    tiles: [
      { label: 'HIGH', value: `${snapshot.high}°`, tone: 'amber' },
      { label: 'LOW', value: `${snapshot.low}°`, tone: 'cyan' },
      { label: 'RAIN', value: `${snapshot.precipitationProbability}%`, tone: 'pink' },
      { label: 'WIND', value: `${snapshot.windSpeed} MPH`, tone: 'green' },
    ],
    updatedLabel: `UPDATED ${relativeTime(snapshot.updatedAt, now)}`,
  };
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
