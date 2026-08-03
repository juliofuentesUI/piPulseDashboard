/**
 * localStorage that cannot throw.
 *
 * It throws rather than no-ops when storage is blocked — private browsing, a
 * locked-down kiosk profile — and a Pi on a wall should not lose its dashboard
 * over a preference it failed to write.
 */

export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preference is lost on reload; the screen still works.
  }
}
