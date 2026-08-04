/**
 * One pixel glyph per trend category, drawn on an 8 x 8 grid.
 *
 * Eight, not the 32 the weather sprites use. These render at 16px, so an 8 x 8
 * cell lands at exactly 2x — every pixel is a clean 2 x 2 block. A 32 x 32
 * sprite scaled to 16px would resample at 0.5 and go soft, which is the same
 * reason the whole panel is authored at 720 x 720 and judged nowhere else.
 *
 * Everything is axis-aligned 1px rows, like `weather-icons/sprite.ts`, so the
 * shapes stay on the grid and inherit the theme through `currentColor`.
 *
 * These have to work as silhouettes. The badge is 16px on a wall display being
 * read from across a room: there is no room for interior detail, and anything
 * that depends on it will read as a smudge. Each glyph below is a single
 * recognisable outline and nothing else.
 */

export interface GlyphRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const r = (x: number, y: number, w: number, h: number): GlyphRect => ({ x, y, w, h });

/** The grid every glyph is drawn on. Rendered at 2x. */
export const GLYPH_GRID = 8;

/**
 * Deliberately distinct silhouettes. The pairs most at risk of collision are
 * called out where they are drawn, because "these two look the same at 16px" is
 * invisible in the source and obvious on the panel.
 */
export const CATEGORY_GLYPHS: Readonly<Record<string, readonly GlyphRect[]>> = {
  /*
   * A ball, drawn as a ring rather than a disc.
   *
   * The first version was a filled 6 x 6 disc and it read as a solid square at
   * 16px: the corner cuts were one grid pixel, so roundness survived at 2px on
   * a 20px mark and the eye simply saw a block. Hollowing it puts the curve on
   * the *inside* edge too, which is what makes it read as round at all.
   */
  sport: [
    r(2, 1, 4, 1),
    r(1, 2, 2, 1),
    r(5, 2, 2, 1),
    r(1, 3, 1, 2),
    r(6, 3, 1, 2),
    r(1, 5, 2, 1),
    r(5, 5, 2, 1),
    r(2, 6, 4, 1),
  ],

  // A portico: roof, three columns, base. Columns sit at 1/3/5 so the glyph is
  // symmetric about the grid's 3.5 centre line.
  politics: [
    r(0, 0, 8, 1),
    r(1, 1, 6, 1),
    r(1, 2, 1, 4),
    r(3, 2, 1, 4),
    r(5, 2, 1, 4),
    r(0, 6, 8, 1),
  ],

  // Three ascending bars. The rising staircase is the read, not the bars.
  business: [r(1, 5, 2, 2), r(3, 3, 2, 4), r(5, 1, 2, 6)],

  // A play triangle. Points right, which nothing else in the set does.
  entertainment: [
    r(2, 1, 1, 1),
    r(2, 2, 2, 1),
    r(2, 3, 3, 1),
    r(2, 4, 3, 1),
    r(2, 5, 2, 1),
    r(2, 6, 1, 1),
  ],

  /*
   * A chip: hollow body, legs out each side.
   *
   * Hollowed for the same reason as `sport` — a filled 4 x 4 body plus four
   * 1px legs is a square with fluff on it at 16px. The window in the middle is
   * what makes the legs read as legs.
   */
  tech: [
    r(2, 2, 4, 1),
    r(2, 5, 4, 1),
    r(2, 3, 1, 2),
    r(5, 3, 1, 2),
    r(1, 3, 1, 1),
    r(1, 5, 1, 1),
    r(6, 3, 1, 1),
    r(6, 5, 1, 1),
  ],

  // A cross. The most universally read shape available at this size.
  health: [r(3, 1, 2, 6), r(1, 3, 6, 2)],

  // Cloud with rain. Shares its language with the weather page's sprites on
  // purpose — it is the same subject, and the panel should not have two
  // vocabularies for weather.
  weather: [
    r(3, 2, 3, 1),
    r(2, 3, 5, 1),
    r(1, 4, 6, 1),
    r(1, 5, 6, 1),
    r(2, 6, 1, 1),
    r(5, 6, 1, 1),
  ],

  /*
   * A burglar's mask: a band across the eyes with two holes cut in it.
   *
   * The user's call, and it is the better mark. This was a shield, which reads
   * as law enforcement — the *response* to a crime rather than the crime — and
   * sat oddly on a story about a victim. A bandit mask is unambiguous and one
   * of the few crime marks that survives 8 x 8, because it is all silhouette.
   *
   * The eye holes are the load-bearing pixels. Lose them and this is a bar.
   */
  crime: [
    r(1, 2, 6, 1),
    r(1, 3, 1, 1),
    r(3, 3, 2, 1),
    r(6, 3, 1, 1),
    r(1, 4, 6, 1),
    r(2, 5, 4, 1),
  ],

  /*
   * A shield — repurposed from `crime`, where it never belonged.
   *
   * Defence and armed forces is what a shield actually says, so it lands on
   * `conflict` correctly and for free. Crossed swords were the alternative and
   * were rejected: two diagonals at 8 x 8 are a staircase, and the result reads
   * as an X, which on any screen means close or cancel.
   */
  conflict: [
    r(1, 1, 6, 1),
    r(1, 2, 6, 1),
    r(2, 3, 4, 1),
    r(2, 4, 4, 1),
    r(3, 5, 2, 1),
    r(3, 6, 2, 1),
  ],

  /*
   * A node cluster: a core with four outlying nodes wired to it.
   *
   * **This was a four-pointed sparkle and the sparkle was wrong.** It is the
   * conventional mark for generated intelligence everywhere else, so it looked
   * like the obvious choice — but a sparkle at 8 x 8 is a cross with four dots
   * on it, and `health` is a cross. Rendered side by side in the legend the two
   * were the same mark. That collision is invisible while you draw glyphs one
   * at a time and obvious the moment they are in a column together, which is
   * the second thing the legend turned out to be good for.
   *
   * A cluster has no straight arms at all, so it cannot be confused with the
   * cross, the chip or the ball.
   */
  ai: [
    r(3, 3, 2, 2),
    r(1, 1, 1, 1),
    r(6, 1, 1, 1),
    r(1, 6, 1, 1),
    r(6, 6, 1, 1),
    r(2, 2, 1, 1),
    r(5, 2, 1, 1),
    r(2, 5, 1, 1),
    r(5, 5, 1, 1),
  ],

  // A lit candle. The hardest call in the set: every conventional mark for
  // death carries a specific culture with it, and a dashboard in a hallway
  // should not pick one. A candle is about as close to neutral as this gets,
  // and it is still not neutral. Worth the user's eyes before it ships.
  obituary: [r(3, 0, 2, 2), r(2, 3, 4, 4)],
};

/**
 * The other candidate for the row: three letters instead of a shape.
 *
 * Costs 53px against the glyph's 24px and is not legible across a room, but
 * needs no learning on day one. Which of the two ships is Question 9 in the
 * plan, and it is settled by looking rather than by argument — so both are
 * built.
 */
export const CATEGORY_ABBREVIATIONS: Readonly<Record<string, string>> = {
  sport: 'SPT',
  politics: 'POL',
  conflict: 'WAR',
  business: 'BIZ',
  entertainment: 'ENT',
  tech: 'TEC',
  // Two letters, not three. It is the one category whose real name is already
  // an abbreviation, and padding it to `AI-` or `AIX` would invent a word.
  ai: 'AI',
  health: 'HLT',
  weather: 'WTR',
  crime: 'CRM',
  obituary: 'OBT',
};

/**
 * What each category means, in the viewer's words rather than the model's.
 *
 * This is the legend's text, and it is deliberately not `CATEGORY_GUIDE` from
 * the API: that one is written *at* a language model and is full of boundary
 * instructions it needs and a person does not. Someone reading a legend on a
 * wall wants to know what the mark means, not how ties are broken.
 */
/*
 * Kept short on purpose. `millennium` spends 60px of the dialog's width on its
 * painted border, so a line that fits the flat themes clips there — measured,
 * with `HOSTILITI…` and `ITSE…` on screen. Shortening the words is the fix that
 * holds in every theme; tuning the column width only moves which one breaks.
 */
export const CATEGORY_MEANINGS: Readonly<Record<string, string>> = {
  sport: 'ATHLETES, TEAMS, RESULTS',
  politics: 'GOVERNMENT, ELECTIONS, POLICY',
  conflict: 'WAR, ARMED FORCES, MILITARY',
  business: 'MARKETS, COMPANIES, MONEY',
  entertainment: 'FILM, TV, MUSIC, CELEBRITY',
  tech: 'DEVICES, SOFTWARE, SCIENCE',
  ai: 'AI MODELS, COMPANIES, POLICY',
  health: 'DISEASE, MEDICINE, RECALLS',
  weather: 'FORECASTS, STORMS, FIRES',
  crime: 'CRIMES, TRIALS, INVESTIGATIONS',
  obituary: 'SOMEONE HAS DIED',
};

/** Legend order: the order they appear, not the order the model sees. */
export const CATEGORY_ORDER: readonly string[] = [
  'sport',
  'politics',
  'conflict',
  'business',
  'ai',
  'tech',
  'entertainment',
  'health',
  'weather',
  'crime',
  'obituary',
];
