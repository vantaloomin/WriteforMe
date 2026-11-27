# Characters write their own lines

Normally one model writes every voice in a scene. With this switched on, each main character in a
scene is first asked, as themselves, what they want from the moment and what they would say. The
writer is then given those lines to work into the scene. The aim is dialogue where people want
different things and sound different, because each line was written from one point of view.

It is **off by default**. It adds model calls, so it costs more and takes longer.

## Switching it on

Settings, Pipeline, **Characters Write Their Own Lines**:

- **Off**
- **Key scenes**: the last scene of each sequence, where the sequence turns.
- **Every scene**

## What happens

Before a fresh draft of a covered scene:

1. Up to four characters in the scene are picked: the Main Character first, then the Challenger,
   Comforter and Warning, then anyone else. A scene with fewer than two named people is skipped.
2. Each gets one call to the prose model. They are told who they are (role, desire, flaw, their
   own profile), how they speak, where they are, how the scene begins, who else is there and how
   they see each of them. They are **not** told what the scene is planned to do, how it turns or
   how it ends.
3. They answer with one sentence on what they want and two to four things they would say.
4. The answer is cleaned in code: speaker tags, stage directions and quotes are removed, repeats
   are dropped, and at most four lines of at most 280 characters are kept.
5. The writer's prompt gets a `<character_lines>` block with each character's want and lines, and
   the instruction to work them in where the scene reaches them. The writer still decides when a
   line is said, who answers and what comes of it, and is told to drop a line the scene's events
   rule out.

A revision of a scene that already has prose does not ask again; it keeps the dialogue it has. A
full rewrite asks again.

## Secrets

A character is given the same profile the writer sees: cover stories applied and unrevealed
truths scrubbed. So a character cannot say what the story has not revealed yet, and the prompt
also tells them that what they are hiding stays hidden. The Secret Leak Check still runs on the
finished scene.

## When something goes wrong

A character whose call fails, or whose answer has no usable line, simply has no lines; the scene
is written anyway. Stop cancels the calls like any other.

## Cost

One extra call per character asked, each small (a few hundred tokens in and out): up to four per
covered scene. The calls show in Logs as "Character Lines: Name (Scene 2.3)" and count toward
Autopilot's token cap.

## Not done

This is the smallest useful piece of what Adventure does. There, every character is an agent every
turn: they declare what they try, react to each other, whisper and lie, and code resolves what
happens before the writer writes. Here the characters speak once, before the scene, and do not
hear each other's lines. They also do not remember earlier scenes beyond what their profile says.

## Where the code is

- `src/domain/cast/characterLines.ts`: who is asked, what they are told, how an answer is read.
- `src/pipeline/characterLines.ts`: the calls.
- `src/prompts/tiers/safeguards.ts`: the `characterLines` prompt.
- `tests/unit/character-lines.test.ts`
