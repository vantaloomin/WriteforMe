# Serial fiction (first slice)

This is the first slice of serial fiction support: the pure logic only. Nothing in the app calls it
yet, so every existing story, prompt and saved file behaves exactly as before.

## What a serial is here

A serial is a series whose "books" are arcs. Each arc is planned with the existing 3-act, 8-sequence
machinery. One object, `SerialState`, carries what outlives an arc:

- **Thread ledger.** Threads have a scope: `series` (the spine), `main` (this arc's A-story) or `side`
  (B and C sized, opening and closing every few episodes). A policy sets how many side threads stay
  open (target 3, range 2 to 4).
- **Cast roster.** Who is active, resting, retired or dead, when they were last on the page, and which
  threads they own.
- **Episodes.** The release unit: a run of existing `"seq-scene"` keys, marked `main` or `interlude`.
- **Story time.** In-world days, separate from release order, so an arc may sit before or beside one
  already published.

## What the module does

`src/domain/serial/` is deterministic bookkeeping. The model still invents what happens.

| File | Purpose |
| --- | --- |
| `types.ts` | Shapes and the default thread and cast policies |
| `threads.ts` | Which threads are open or live; folding an episode's outcome back into the ledger |
| `scheduler.ts` | `scheduleEpisode`: what the next episode advances, closes, parks and opens, who is due on the page and how it ends. `scheduleAhead` does the same for a whole sequence, because scenes are planned a sequence at a time |
| `cast.ts` | `planArcCast` and `applyArcCast`: who is seated for the next arc. `reassignThreadsOf` for a character who dies or retires |
| `storyTime.ts` | `checkArcTimeFits`: is a flashback or parallel arc consistent with what is published |
| `promptBlock.ts` | `formatSerialContext`: the `<serial_context>` block, empty unless a serial and a plan are given |

The rules worth knowing:

- An arc has phases: opening, middle, wrap-up (the last 3 episodes) and finale.
- The main thread is in every main episode and closes on the finale. The finale also moves a series
  thread and ends on a reveal.
- A side thread closes only after it has been moved by at least 2 episodes.
- The next arc's cast is picked at the start of the wrap-up. A departing character's threads are
  closed, or parked on the finale with an on-page exit. A thread with no owner on stage that was never
  parked raises a warning, because that is a dropped plot. At most 3 threads should be parked at once.
- No new side threads open in the last 2 episodes of an arc.
- Interludes sit between arcs. They close and open nothing, and check in on the longest-parked thread.
- Cast rotation is `anchored` (a fixed lead or core, others rotate) or `ensemble` (anyone may rest).
  Seats go by `oldest_thread` (default), `longest_absent` or `balanced`. With `everyoneOwnsThread`
  on, every core or supporting character on stage owns or co-owns an open thread.

## Not in this slice

- The `serial` field on `Story`, and any save or migration change.
- Calls from the pipeline: no prompt builder uses `formatSerialContext`, and the continuity call does
  not report thread updates yet.
- Any UI: setup option, thread board, roster panel, episode grouping.
- Flashback continuity. That should query the existing belief graph
  (`src/domain/continuity/epistemicGraph.ts`), which first needs scene coordinates that order scenes
  across arcs.
- The book-series slice this builds on. `OpenThread` and its three companion types are declared in
  `types.ts` for now and should move to the series module when it lands.

## Tests

`tests/unit/domain-serial.test.ts` runs four 8-episode arcs with an interlude between arcs 2 and 3 and
checks the rules above, plus the cast, story-time and prompt-block helpers.

```
npx vitest run tests/unit/domain-serial.test.ts
```
