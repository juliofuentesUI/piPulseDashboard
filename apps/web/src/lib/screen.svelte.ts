/**
 * Which of the two layouts the panel is showing.
 *
 * Persisted for the same reason the theme is: the Pi is a wall display that
 * gets power-cycled, and coming back up on a screen nobody chose would read as
 * the dashboard having forgotten itself.
 */

import { readSetting, writeSetting } from './storage';

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
  const id = readSetting(STORAGE_KEY);
  return SCREENS.find((screen) => screen.id === id) ?? DEFAULT_SCREEN;
}

export class ScreenStore {
  current = $state<Screen>(storedScreen());

  /** A deliberate choice, so it is remembered. */
  select(screen: Screen): void {
    this.current = screen;
    writeSetting(STORAGE_KEY, screen.id);
  }

  /**
   * Shows a layout without remembering it.
   *
   * Attract mode walks through both weather layouts, and it must not overwrite
   * the one the user picked while doing so — a tour is not a decision. This is
   * the same assignment `select` makes, minus the part that persists.
   */
  show(screen: Screen): void {
    this.current = screen;
  }

  /** Back to whatever was last chosen deliberately. */
  restore(): void {
    this.current = storedScreen();
  }
}
