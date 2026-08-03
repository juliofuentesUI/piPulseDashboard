/**
 * Which of the two layouts the panel is showing.
 *
 * Persisted for the same reason the theme is: the Pi is a wall display that
 * gets power-cycled, and coming back up on a screen nobody chose would read as
 * the dashboard having forgotten itself.
 */

export type ScreenId = 'dashboard' | 'week';

export interface Screen {
  readonly id: ScreenId;
  /** Shown in the settings list. Keep it short. */
  readonly name: string;
}

export const SCREENS: readonly Screen[] = [
  { id: 'dashboard', name: 'WEATHER NOW' },
  { id: 'week', name: '7-DAY FORECAST' },
];

const DEFAULT_SCREEN = SCREENS[0] as Screen;

const STORAGE_KEY = 'pipulse:screen';

/** The last screen chosen on this device, or the default. */
export function storedScreen(): Screen {
  const id = read(STORAGE_KEY);
  return SCREENS.find((screen) => screen.id === id) ?? DEFAULT_SCREEN;
}

export class ScreenStore {
  current = $state<Screen>(storedScreen());

  select(screen: Screen): void {
    this.current = screen;
    write(STORAGE_KEY, screen.id);
  }
}

// localStorage throws rather than no-ops when storage is blocked, and a Pi
// kiosk should not lose its dashboard over a preference.

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preference is lost on reload; the screen still works.
  }
}
