/**
 * How the category badge draws itself: as a pixel glyph, or as three letters.
 *
 * Both shipped rather than one, because the render that was supposed to settle
 * it settled it both ways. Measured at 720 x 720: the glyph costs 24px of a
 * row against the abbreviation's 53px, but at 16px its silhouettes are quiet
 * and two of them had to be hollowed out before they stopped reading as plain
 * squares. The letters identify themselves instantly and cost more title.
 *
 * The legend is what makes the glyph viable at all — "you have to learn it" was
 * the whole case against it, and a legend is the answer to that. So the two go
 * together, and the choice is the viewer's rather than ours.
 */

import { readSetting, writeSetting } from './storage';

export type BadgeStyle = 'glyph' | 'text';

export const BADGE_STYLES: readonly { id: BadgeStyle; name: string }[] = [
  { id: 'text', name: 'TEXT' },
  { id: 'glyph', name: 'GLYPH' },
];

const STORAGE_KEY = 'pipulse:badge';

/**
 * Text is the default.
 *
 * A dashboard that has just been switched on should be readable before anybody
 * has opened the legend, and letters are. Someone who prefers the quieter mark
 * can switch, and by then they know what the marks mean.
 */
const DEFAULT_STYLE: BadgeStyle = 'text';

function stored(): BadgeStyle {
  return readSetting(STORAGE_KEY) === 'glyph' ? 'glyph' : DEFAULT_STYLE;
}

export class BadgeStore {
  current = $state<BadgeStyle>(stored());

  select(style: BadgeStyle): void {
    this.current = style;
    writeSetting(STORAGE_KEY, style);
  }
}
