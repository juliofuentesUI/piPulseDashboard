# Attract mode — Plan

**Status: built, 2026-08-04.** Requested and specified the same day; the three questions
below were answered by the user before any code was written, and their answers are recorded
in place. Verified end to end — see "What was verified" at the bottom.

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

## The three questions, and how they were answered

### 1. What is in the tour? — **ANSWERED: the four full-screen views, no modals**

The deciding constraint came from the user, and it is stronger than the loop-length
argument below: *"I don't wanna see the modal window popping up... I just want you to
directly open up those views programmatically."*

So the tour visits **both weather layouts and both Search Pulse views**, and it switches the
weather layout **directly** rather than by opening the settings dialog. A dialog appearing
on its own is exactly what was ruled out. Four stops, a twenty-second loop, nothing pops.

That also settled the trend card and trend record: neither is in the tour. Adding cards
later is a change to `ATTRACT_TOUR` and nothing else.

The original sizing argument, kept because it is still the reason not to add everything:

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

Cards were the recommendation before the no-modals constraint arrived, on the grounds that a
trend card is the strongest thing to look at from across a room. That is still true and
still the obvious first extension — but it is a change to make deliberately, not one to
assume.

### 2. Where is the hidden control? — **ANSWERED: a two-second hold on the title**

It has to be unreachable by accident on a touchscreen where every other interaction is a
tap, and findable by the one person who knows it exists. It is also **not urgent to find**,
because attract mode starts on its own after a minute — this is only for starting it now.

Candidates, best first:

- **Long-press the title bar** (~2s). Large target, impossible to hit by accident, and the
  title is already the one part of every screen with no other tap behaviour.
- Double-tap a specific corner. Small target on a panel with a painted frame.
- A tap sequence on the page indicator. Discoverable by accident over a long enough time.

**Chosen: long-press the title**, two seconds, on `h1.title` rather than the whole bar so
holding the menu grid does nothing. It is not a `<button>`: it has no tap behaviour, no
affordance, and announcing one would defeat a hidden control.

The acknowledgement question answered itself. **Starting the tour advances it immediately**
rather than waiting out the first interval, so the panel visibly changes the instant the
hold fires. That is the acknowledgement, and it is why the mode needs no badge — a screen
that changes every five seconds is self-evidently driving itself. A persistent `AUTO`
marker was considered and dropped as clutter on a display whose whole point is being
uncluttered.

### 3. Does the settings dialog suspend it? — **ANSWERED: yes, the timer stops entirely**

Opening settings is an interaction, so attract mode stops. The question is what happens if
it is left open: resuming the tour underneath an open dialog would be wrong, and closing
the user's dialog for them would be worse. **Chosen: while any dialog is open the idle timer does not run at all**, so attract mode
cannot resume until it is closed. This covers the settings dialog *and* the trend record,
both tracked in one `$effect` in `App.svelte`.

## Implementation notes and hazards

**The tour must not read its own navigation as a person.** It advances by setting
`scrollLeft` and by calling the same handlers a tap calls, so a listener on `scroll` would
see the tour's first step as a touch and switch it off immediately. **Solved by listening to
`pointerdown`, `keydown` and `wheel` only** — genuine input devices, never scroll. No
suppression flag was needed, and none should be added: the flag approach has to be got right
at every call site, and this has to be got right once.

**Two things had to move before the tour could be honest.**

`ScreenStore` gained `show()` and `restore()`. The tour visits both weather layouts, and
`select()` persists — so touring with it would silently overwrite the layout the user chose.
`show()` is the same assignment without the write, and `onstop` calls `restore()`, so
handing control back to a person returns exactly what they had. Verified: with `week` saved,
the tour displayed `dashboard`, and a touch put `week` back with `localStorage` unchanged.

The trend card's open flag moved from `SearchPulse.svelte` into the `Trends` store. The card
takes over the whole Search Pulse page, so a card left open would still be covering it when
the tour came back round. The tour closes it on every step.

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

## What was verified

Driven end to end at 720 x 720 against the running app, not reasoned about:

| Behaviour | Result |
| --- | --- |
| Two-second hold on the title starts it | Starts, and moves at once |
| The tour cycles and loops | `WEATHER/NOW → 7-DAY → PULSE/NOW → PULSE/TODAY → WEATHER/NOW` |
| A touch stops it | Stopped, and still on the same screen six seconds later |
| The chosen weather layout survives | `week` saved, restored on touch, `localStorage` untouched |
| An open dialog blocks the countdown | Settings held open **103 s**, tour never started |
| It resumes on its own | Resumed **101 s** after the last input |

The two timing tests are the ones worth re-running if this is ever refactored. They are slow
and dull, and they are the only way to catch an idle timer that silently never fires.
