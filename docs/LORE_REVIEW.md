# Review mode for lore the model adds

While it plans and writes, the model picks up new world facts ("the Marrow floods every ninth
year") and adds them to the story's lore by itself, where later scenes find them. That keeps the
world consistent, but it also means the model can make something canon that the author never saw.

**Review New Lore** (Settings, Pipeline; off by default) puts the author in between.

## With it on

- A new fact from the model does not go into the lore and is not indexed. It waits on the story
  as a proposal, with the act and scene it came from.
- A message says how many are waiting.
- The Lore page shows them at the top under **Proposed by the model**. Each has **Approve** and
  **Dismiss**, and there are **Approve All** and **Dismiss All**.
- Approving indexes the fact and adds it to the lore, exactly as if it had been added at the time.
  Dismissing throws it away.

A fact that is still waiting is **not** used when later scenes are written. During a long
unattended run, that means the model may contradict a fact it proposed earlier, or propose it
again in other words. Review between sittings, or leave the option off for unattended runs.

A fact that repeats a waiting proposal or an existing lore item word for word is not queued twice.
At most 200 proposals are kept; past that the oldest are dropped.

## What is not held back

Only new lore is reviewed. The other things the model updates after a scene go in at once as
before, because the next scene depends on them: where each character is and what they know, the
"story so far", relationships, and who knows which secret. Lore you add or import yourself is
never held back.

## Where this comes from

Worldsmith's drafts work the same way: the model proposes entries and nothing lands until the
author approves. Worldsmith also checks each proposal against a schema and can undo an approval;
here an approved fact is an ordinary lore item and is removed like any other.

## Where the code is

- `src/domain/lore/proposals.ts`: the queue, kept on the story as `pending_lore`.
- `src/pipeline/lorePipeline.ts` (`handleWorldUpdates`): holds new lore back when the option is on.
- `src/views/lore/LoreProposalsPanel.tsx`: the panel.
- `tests/unit/lore-review.test.tsx`
