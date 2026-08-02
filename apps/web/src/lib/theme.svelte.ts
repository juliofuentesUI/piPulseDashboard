/**
 * Themes are pure data: seven colours, published as CSS custom properties on
 * `<html>`. Every rule in the app — panel fills, dividers, type, and the
 * pixel sprites — resolves back to one of these seven, so adding a look means
 * adding one object to `THEMES` and nothing else.
 *
 * The tokens are named for their role in the artwork rather than their hue, so
 * an inverted theme like `midnight` stays coherent: `ink` is whatever draws
 * outlines and headings, light or dark.
 */

export interface Palette {
  /** Page and panel background. */
  readonly bg: string;
  /** Raised surface: cloud bodies, the fill behind large numbers. */
  readonly surface: string;
  /** Outlines, borders, headings, primary numbers. */
  readonly ink: string;
  /** Secondary labels and framing. */
  readonly blue: string;
  /** Soft accent: cloud shading, rain, wind. */
  readonly sky: string;
  /** Sun and moon bodies, highlights. */
  readonly warm: string;
  /** Rays, warm outlines, small accents. */
  readonly hot: string;
}

export interface Theme {
  readonly id: string;
  /** Shown briefly when the theme is switched. Keep it short. */
  readonly name: string;
  readonly palette: Palette;
}

export const THEMES: readonly Theme[] = [
  {
    id: 'gba-blue',
    name: 'GBA BLUE',
    palette: {
      bg: '#f8f5ed',
      surface: '#ffffff',
      ink: '#082b69',
      blue: '#2868b8',
      sky: '#73aeef',
      warm: '#ffc928',
      hot: '#f28a16',
    },
  },
  {
    id: 'midnight',
    name: 'MIDNIGHT',
    palette: {
      bg: '#081428',
      surface: '#10233f',
      ink: '#eaf2ff',
      blue: '#73aeef',
      sky: '#2e5e9e',
      warm: '#ffc928',
      hot: '#f28a16',
    },
  },
  {
    id: 'dmg-green',
    name: 'DMG GREEN',
    palette: {
      bg: '#8bac0f',
      surface: '#9bbc0f',
      ink: '#0f380f',
      blue: '#306230',
      sky: '#5d7f14',
      warm: '#c9dc6b',
      hot: '#306230',
    },
  },
  {
    id: 'amber',
    name: 'AMBER CRT',
    palette: {
      bg: '#1a1206',
      surface: '#26190a',
      ink: '#ffcf6b',
      blue: '#c98a2e',
      sky: '#7a5216',
      warm: '#ffe9a8',
      hot: '#ff9e2c',
    },
  },
];

/** Falls back to the first theme, which app.css also hard-codes as its default. */
const DEFAULT_THEME = THEMES[0] as Theme;

const STORAGE_KEY = 'pipulse:theme';

/** Writes a palette onto `<html>`, where every `var(--c-*)` lookup resolves. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [token, value] of Object.entries(theme.palette)) {
    root.style.setProperty(`--c-${token}`, value);
  }
  root.dataset['theme'] = theme.id;
}

/** The last theme chosen on this device, or the default. */
export function storedTheme(): Theme {
  const id = read(STORAGE_KEY);
  return THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}

/**
 * The theme currently on screen, plus the means to move to the next one.
 *
 * Swapping is a synchronous property write on one element — no rebuild, no
 * reload, and nothing to re-fetch, which is the whole point of keeping themes
 * to custom properties.
 */
export class ThemeStore {
  current = $state<Theme>(storedTheme());

  /** Advances to the next theme, wrapping around, and remembers the choice. */
  next(): Theme {
    const index = THEMES.indexOf(this.current);
    const theme = THEMES[(index + 1) % THEMES.length] ?? DEFAULT_THEME;

    this.current = theme;
    applyTheme(theme);
    write(STORAGE_KEY, theme.id);
    return theme;
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
