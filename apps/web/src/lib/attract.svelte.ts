/**
 * The dashboard driving itself when nobody is touching it.
 *
 * A wall display's resting state should be the one that shows the most, not
 * whichever page happened to be left over from the last swipe. Left alone, this
 * walks the screens on a timer; touched, it gets out of the way at once and
 * gives the panel back.
 *
 * Called *attract* rather than "carousel", which is what the user calls it,
 * because `carousel` already names the two-page horizontal scroller in
 * `App.svelte` and throughout the documents. Attract is the arcade and kiosk
 * term for exactly this behaviour.
 *
 * **It adds no navigation.** Every stop is somewhere a finger could already
 * reach, and it gets there by the same calls a tap makes. The two-page rule is
 * untouched: this drives what exists, it does not extend it.
 */

import type { PulseView } from './trend-view';
import type { ScreenId } from './screen.svelte';

/** How long each stop holds. The user asked for five seconds. */
export const ATTRACT_STEP_MS = 5_000;

/**
 * How long the panel must go untouched before it takes over again.
 *
 * Long enough to read a trend card without the dashboard snatching it away,
 * short enough that a display nobody is at does not sit on one screen all day.
 */
export const ATTRACT_IDLE_MS = 60_000;

/**
 * One stop on the tour: a page, and the state that page should be in.
 *
 * Both weather layouts are here even though only one is ever *chosen*, because
 * the tour switches between them directly. It must never do that by opening the
 * settings dialog — a dialog appearing on its own looks broken, and the user
 * ruled it out explicitly. `ScreenStore.show` exists for this.
 */
export interface AttractStop {
  /** Index into the carousel's pages. */
  readonly page: number;
  /** Which weather layout, when the stop is on the weather page. */
  readonly screen?: ScreenId;
  /** Which Search Pulse view, when the stop is on that page. */
  readonly pulse?: PulseView;
}

/**
 * The tour, in order. Four stops, twenty seconds a loop.
 *
 * Deliberately all four *full-screen* views and nothing else. No dialog, no
 * modal, and for now no trend card: a card is a fine thing to look at from
 * across a room, but adding five of them makes the loop three times longer and
 * mostly panels opening and closing. The trend record is worse again — it is a
 * dense scrollable reference panel that five seconds cannot show.
 *
 * Adding cards later is a change to this array and nothing else.
 */
export const ATTRACT_TOUR: readonly AttractStop[] = [
  { page: 0, screen: 'dashboard' },
  { page: 0, screen: 'week' },
  { page: 1, pulse: 'now' },
  { page: 1, pulse: 'today' },
];

/**
 * Owns the timers and the position in the tour. It knows nothing about how a
 * stop is applied — the caller passes that in, so this file has no opinion
 * about the carousel, the stores, or the DOM.
 */
export class Attract {
  /** True while the tour is running. */
  active = $state(false);

  #index = 0;
  #step: ReturnType<typeof setInterval> | undefined;
  #idle: ReturnType<typeof setTimeout> | undefined;

  /**
   * True while something modal is open. The idle timer does not run at all
   * then: resuming the tour underneath an open dialog would be wrong, and
   * closing the user's dialog for them would be worse.
   */
  #suspended = false;

  readonly #apply: (stop: AttractStop) => void;
  readonly #onstop: () => void;

  constructor(handlers: {
    /** Puts the panel into the given stop's state. */
    apply: (stop: AttractStop) => void;
    /** Called when the tour stops, so the caller can undo anything transient. */
    onstop: () => void;
  }) {
    this.#apply = handlers.apply;
    this.#onstop = handlers.onstop;
  }

  /**
   * Begins the tour and moves at once.
   *
   * Moving immediately is what acknowledges the hidden long-press: without it,
   * the control gives no sign it worked until the first interval elapses, and
   * five seconds of nothing reads as a control that did not fire. It is also
   * why the mode needs no badge — a panel that changes every five seconds is
   * self-evidently driving itself.
   */
  start(): void {
    if (this.active) return;
    this.active = true;
    this.#clearIdle();

    this.#advance();
    this.#step = setInterval(() => this.#advance(), ATTRACT_STEP_MS);
  }

  /**
   * Hands the panel back. Does not reset the position, so resuming carries on
   * through the tour rather than starting over.
   */
  stop(): void {
    if (this.#step !== undefined) clearInterval(this.#step);
    this.#step = undefined;

    if (this.active) {
      this.active = false;
      this.#onstop();
    }
  }

  /**
   * Genuine input from a person: stop, and start counting towards resuming.
   *
   * Deliberately driven by pointer and key events rather than by scroll. The
   * tour navigates by scrolling the carousel, so a scroll listener would see
   * the tour's own first step as a person touching the panel and switch itself
   * off immediately.
   */
  touched(): void {
    this.stop();
    this.#restartIdle();
  }

  /** Modal open or closed. While open, the idle countdown does not run. */
  suspend(suspended: boolean): void {
    if (this.#suspended === suspended) return;
    this.#suspended = suspended;

    if (suspended) {
      this.stop();
      this.#clearIdle();
    } else {
      this.#restartIdle();
    }
  }

  /** Starts the countdown, so an untouched panel takes itself over. */
  begin(): void {
    this.#restartIdle();
  }

  dispose(): void {
    this.stop();
    this.#clearIdle();
  }

  #advance(): void {
    const stop = ATTRACT_TOUR[this.#index % ATTRACT_TOUR.length];
    this.#index = (this.#index + 1) % ATTRACT_TOUR.length;
    if (stop !== undefined) this.#apply(stop);
  }

  #restartIdle(): void {
    this.#clearIdle();
    if (this.#suspended) return;
    this.#idle = setTimeout(() => this.start(), ATTRACT_IDLE_MS);
  }

  #clearIdle(): void {
    if (this.#idle !== undefined) clearTimeout(this.#idle);
    this.#idle = undefined;
  }
}
