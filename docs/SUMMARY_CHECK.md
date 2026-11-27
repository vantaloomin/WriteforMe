# Story so far check

The "story so far" is rewritten by a model as scenes are drafted. The only check on a rewrite used to be its
length. Over a long novel a rewrite can drop a name, a sum of money or a promise that the earlier summary held, and
later scenes are planned from the summary.

Before a new summary replaces the old one, code now checks that it still holds:

- every **quote** the summary before it kept,
- every **pledge said aloud** in the newly drafted text shown to the summarizer (a quote with words such as
  promise, swear, owe, debt, deal, confess, "never tell"),
- every **cast name** the summary before it mentioned (a first name counts for a full name),
- every **number** the summary before it mentioned (a small number may be written as a word).

At most 40 items are tracked per update.

If the draft drops something, the summarizer is asked once more with a list of what it dropped. The draft that
drops less is used. Whatever is still missing is added after the summary as an "Also kept: ..." line, word for
word. An update is never blocked, and the pipeline log records what happened under "Story So Far: summary check".

The first summary of a story has nothing before it and is not checked. A retry costs one more call and only
happens when something was dropped.

Turn it off under **Settings, Pipeline, Story So Far Check**.

Code: `src/domain/story/summaryCheck.ts`, used by `updateStorySoFar` in `src/pipeline/storySoFar.ts`. The method
is ported from Prospero's Adventure (`adventure/compaction.py`).

## Limits

- It checks words, not meaning. A summary can keep a name and still get the event wrong.
- Because numbers and quotes are never dropped, the "Also kept" line can grow on a story full of them. The
  40-item limit bounds it.
- Place names and lore terms are not tracked, only the cast.
- Not run against a real model.
