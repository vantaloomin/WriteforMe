# Dialogue ping-pong and echoing

Two dialogue habits that a phrase list cannot see. Both are read from the shape of the paragraphs, with no model call.

| Habit | What it is | When it flags |
| --- | --- | --- |
| Ping-pong | Short paragraphs that each open on a spoken line, one after another, with no paragraph of action, interiority or description between them. | 6 or more in a row, each 30 words or fewer. |
| Echoing | A reply built from the previous speaker's words: "You can sew and chew." / "I can sew and chew and judge you." | 3 or more in one scene. One or two are left alone. |

A reply counts as an echo when it reuses a run of three or more words from the spoken line before it, or opens on the same two words as one of that line's sentences ("Like a gusset?" / "Like a second refrigerator."). Openings on a pronoun or an article are ignored, and so are runs made only of the story's own names. Two spoken paragraphs are an exchange when at most one paragraph of narration sits between them.

Both are off in audio drama. A script is all turns by design, and its prompt asks for echoes so a listener keeps hold of plot facts.

## Where it reaches

- **Settings, AI Slop Audit, Patterns & Rhythm Rules:** two rules, `dialogue_ping_pong` and `dialogue_echo`, each switchable like the others.
- **The reviewer:** the scene validator turns the hits into one line per habit under `<advisory_stylistic_observations>`, and the Writing Agent Reviewer has a MAJOR criterion for each (25 and 26).
- **Polish and the surgical editor:** the hits appear as density warnings in the slop audit block.
- **The writer:** one line in the dialogue section of the system prompt, and the agentic writer's draft check reports both.

## Code

| Path | Holds |
| --- | --- |
| `src/domain/slop/dialogueShape.ts` | `detectDialoguePingPong`, `detectDialogueEchoes`, `dialogueShapeAdvisories` |
| `src/domain/slop/registry.ts` | The two density rules and their thresholds (`count`, `window`) |
| `src/domain/slop/scanner.ts` | Runs them inside `scanTextForSlop` |
| `tests/unit/slop-dialogue-shape.test.ts` | Tests |

## Not done

- The speaker of a line is not known, so a character who repeats their own words across two paragraphs counts as an echo.
- The editorial pass (`nlpTelemetry.ts`, the tribunal) does not read these two rules yet.
- A story that imported a slop pack with its own density rules does not get these until the pack lists them.
