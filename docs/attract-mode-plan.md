# Attract mode — Plan

**Status: specified, not started.** Requested by the user on 2026-08-04. Nothing here is
built. Read this before starting it, and settle the three open questions at the bottom
first — two of them change the shape of the code.

## What it is

The dashboard drives itself. Left alone, it cycles through its screens on a timer, five
seconds each, so a wall display shows everything it knows instead of whichever page was
last swiped to. Touching it hands control back immediately; leaving it alone gives control
back to the dashboard a minute later.

The user's word for this is **"carousel mode"**. This document calls it **attract mode**,
which is the established term for the same thing on arcade cabinets and kiosks, because
`carousel` is already taken: `.carousel` in `App.svelte` is the two-page horizontal
scroller, `PAGES` is its contents, and every existing document uses "the carousel" to mean
that. One word cannot mean both without costing somebody an hour. **If the user's term is
preferred in the UI, that is fine — but keep `attract` in code and docs.**

## Why it earns its place

- **The panel now runs continuously.** As of 2026-08-04 the Pi autostarts and collects all
  day. A static layout on an always-on screen is exactly the burn-in case Phase 5 already
  lists, and a display that moves every five seconds is most of the answer to it.
- **The dashboard has more to show than fits.** There are now two pages, two Search Pulse
  views, a trend card and a trend record. A glance display that only ever shows one of them
  is wasting the rest.
- **Nobody is standing at it.** It is a wall display. The resting state should be the one
  that shows the most, not the one that happens to be left over from the last touch.

## Behaviour

A small state machine with two states and three transitions.

| From | Event | To |
| --- | --- | --- |
| Idle (attract running) | any touch or pointer input | Interactive |
| Interactive | 60 seconds with no input | Idle |
| Interactive | the hidden control | Idle, immediately |

- **Attract advances every 5 seconds**, moving to the next stop in the tour.
- **Any real input stops it at once** — a tap, a swipe, a press. It does not finish the
  current step first; it stops where it is and stays there.
- **60 seconds after the last input, it resumes.** From wherever the user left it, not from
  the beginning.
- **The hidden control starts it immediately**, without waiting out the minute.

Both intervals should be named constants in one place, not sprinkled through components.

## What it must not change

**The horizontal carousel stays two pages.** This is the user's standing rule and attract
mode does not touch it. Attract mode *drives the navigation that already exists* — the same
scroll the page indicator performs, the same taps a finger performs. It adds no page, no
route and no new way to reach anything. If a step in the tour needs new navigation to be
reachable, that is a signal the tour is wrong, not that the rule is.

Nothing about the three fixed 720 x 720 layouts changes either. Attract mode is a timer and
a state machine; it must not need a single pixel of layout to move.

## Open questions — settle these before writing code

### 1. What is in the tour?

The user asked for "all the views and subviews". Taken literally that is:

```
weather (whichever layout settings chose)
search pulse · NOW
  trend card x5          one per visible trend
search pulse · TODAY
  trend record x10       one per day row
```

Seventeen stops at five seconds is an **85-second loop**, and about three quarters of it is
modals opening and closing. That may read as frantic rather than informative, and the trend
record in particular is a dense panel that five seconds cannot be read in.

| Option | Stops | Loop | Note |
| --- | --- | --- | --- |
| Top level only | 3 | 15s | Calm, and shows every *screen*. Never opens a card. |
| Top level + cards | 8 | 40s | Shows what trends are *about*, which is the best content on the dashboard. |
| Everything | 17 | 85s | What was literally asked for. Long, and record panels are unreadable in 5s. |

**Recommendation: top level + cards.** The trend card is the strongest thing to look at
from across a room; the trend record is a reference panel you open deliberately, and it
carries a scrollable table that a five-second stop cannot show.

### 2. Where is the hidden control?

It has to be unreachable by accident on a touchscreen where every other interaction is a
tap, and findable by the one person who knows it exists. It is also **not urgent to find**,
because attract mode starts on its own after a minute — this is only for starting it now.

Candidates, best first:

- **Long-press the title bar** (~2s). Large target, impossible to hit by accident, and the
  title is already the one part of every screen with no other tap behaviour.
- Double-tap a specific corner. Small target on a panel with a painted frame.
- A tap sequence on the page indicator. Discoverable by accident over a long enough time.

**Recommendation: long-press the title.** Needs a visible acknowledgement when it fires —
the mode is otherwise indistinguishable from the screen advancing on its own.

### 3. Does the settings dialog suspend it?

Opening settings is an interaction, so attract mode stops. The question is what happens if
it is left open: resuming the tour underneath an open dialog would be wrong, and closing
the user's dialog for them would be worse. **Suggested: while any dialog is open the idle
timer does not run at all**, so attract mode cannot resume until the dialog is closed.

## Implementation notes and hazards

**Distinguish the tour's own navigation from the user's.** Attract mode advances by setting
`scrollLeft` and by calling the same handlers a tap calls. If those fire the same listeners
that stop attract mode, it will stop itself on its first step. Whatever detects "the user
touched it" has to ignore input the tour generated — a flag around programmatic
navigation, or listening only to genuine pointer events rather than to scroll.

**`scroll-behavior: smooth` and `scroll-snap-type: x mandatory` are already on `.carousel`,**
and the page indicator already scrolls it programmatically. Reuse that path rather than
inventing a second one.

**`prefers-reduced-motion` is already honoured** for the scroll animation. Consider whether
it should also lengthen or disable the tour; a five-second auto-advance is motion.

**TODAY refetches when it opens.** In a tour that visits it every loop, that is a SQLite
read every 15-40 seconds. Cheap and local, but worth knowing before adding a stop that
polls something remote.

**Attract mode overlaps the Phase 5 burn-in item.** A screen that moves every five seconds
for most of the day is doing most of that job already. Do not build both without first
deciding what burn-in protection still has to cover — most likely just the idle minute
before attract resumes.

**The trend card and record read live state.** Both are derived from the current list, so a
poll landing mid-tour refreshes them rather than leaving them stale. No extra work needed;
just do not cache a snapshot when opening them from the tour.
