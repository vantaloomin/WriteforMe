# Cast board and cast checks

Two additions to the Cast page, in one panel above the character cards: **Cast Board & Checks**.
Neither calls a model.

## Cast checks

The Four-Corner Web is read in code, and anything that looks unfinished is listed with a reason
and a fix. Nothing is blocked and nothing is changed; the list is advice.

| Check | Says |
| --- | --- |
| Missing corner | The web has no Main Character, Challenger, Comforter or Warning |
| Two main characters | More than one character is set as the Main Character |
| Empty corner fields | A corner has nothing for what its role asks (the Challenger's way of living, the Warning's wake-up call, and so on) |
| No flaw or desire | A corner character still has the starting text, or nothing |
| Same desire | Two corner characters want the same thing in the same words |
| Same name | Two characters share a name |
| Crowd | More than 12 characters |
| Missing character | A relationship names someone who is not in the cast |

Three notes always show when the corner is filled, as reminders of what makes it work: the
Challenger should be tempting and still flawed, the Comforter safe and not sinister, the Warning
someone the reader feels for.

The count beside the panel title is the number of checks, not counting notes.

## Cast board

A board lays the cast out on **four sides** and says what each side stands for. It is the author's
plan for who is fighting whom, and over what.

1. Under **Sides**, pick a genre. There are 17, each with the four sides a story of that kind
   usually has (a heist: the crew, the mark, the law, the rival outfit). "My own four sides" starts
   from blank ones.
2. Write the **theme question**: the one question the story asks.
3. For each side, write what it stands for. The grey text is the template's hint. A side's name
   can be changed.
4. Press a character's name under a side to put them on it. A character is on one side at a time.

Picking another genre keeps what was written and who was placed, position by position. "No board"
removes it.

With a board, the checks also say when there is no theme question, when a side has no stance or no
one on it, when two sides stand for the same thing, who is on no side, and when a placed character
has left the cast. For a mystery or noir, a side with several people gets the note that they should
share a motive and each hide something different.

## What the writer is told

When a character in a scene is placed on a side, their profile in the scene-writing prompt gets
one more line: `<stands_with>The crew: One last job, then out.</stands_with>`. Without a board, the
prompt is exactly as before.

## Not done

This is the first step of the two-layer board in Dramatis. Not ported: the inner square (people
on one side who share its why and fight over how), "how" tags and the resonance candidates they
produce (likely defectors, double agents, mirrors), group templates, and model-backed checks. The
board is not used when a cast is first generated, only when scenes are written.

## Where the code is

- `src/domain/cast/templateData.ts`: the genre templates, from Dramatis `cast_genres.json`.
- `src/domain/cast/board.ts`: the board kept on the story as `cast_board`.
- `src/domain/cast/checks.ts`: the checks.
- `src/views/cast/CastBoardPanel.tsx`: the panel.
- `tests/unit/cast-board.test.tsx`
