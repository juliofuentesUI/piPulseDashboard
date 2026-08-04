/**
 * TEMPORARY — the C0 design render only. Delete once the badge is decided.
 *
 * The badge has to be judged in place, at 720 x 720, against real titles and
 * the real crowding of a row. A mockup in isolation flatters it: this project
 * has measured four wrong answers in a row by eyeballing overlap, and the whole
 * reason there is a C0 gate is that the render, not the argument, decides.
 *
 * So these categories are assigned by row position rather than inferred. That
 * is honest for a *design* review — what is being judged is the mark, its
 * weight and whether it fits, none of which depend on the label being correct
 * for that particular trend.
 *
 * The TODAY spread deliberately shows all nine glyphs at once, because the
 * question "can these be told apart" cannot be answered one at a time.
 */

/** Five rows, in the proportions the measured feed actually produces. */
export const DEMO_NOW = ['sport', 'sport', 'business', 'politics', 'weather'];

/** Ten rows covering every glyph in the set, plus one repeat. */
export const DEMO_TODAY = [
  'sport',
  'politics',
  'business',
  'entertainment',
  'weather',
  'crime',
  'tech',
  'health',
  'obituary',
  'sport',
];

/*
 * The `?badge=` switch that drove the C0 comparison captures is gone: the
 * choice is a real, remembered setting now, in `badge.svelte.ts`. Only the
 * fake category assignment above is still temporary.
 */
