# Usage and call costs in the log

The top of the log is a usage summary: total tokens and cost, one bar split into input, cache
write, cache read, thinking and output, and a table of the pipeline steps that used the most
(`src/views/logs/LogUsage.tsx`, sums in `src/domain/story/usageSummary.ts`). It starts closed,
as the totals line and the bar; a click on that line opens the legend and the table, and the
choice is remembered. Each finished
model call shows what it cost, and its cache read and cache write counts when it has any. `≈ $0.076` is an estimate (tokens times a list price); a bare `$0.0041` is
the charge the provider reported. Local providers (KoboldCPP, the Claude Code and Codex
bridges), free models and models nobody has a price for show nothing.

## Models and filters

Open, the summary also lists the models that ran (one chip each, with tokens and cost). The
step table gets a Model column when more than one model ran. Model chips and step rows are
filters: click one and the log below shows only the calls that match. A picked chip is filled,
a picked row is bold with a bar at its left edge, and the unpicked ones in that list go quieter.
Picks of one kind add up (two steps show both); the two kinds narrow each other (a model and a
step show that step's calls on that model).

Only the totals line, the bar and its legend follow the selection (`72.2K tokens in 6 of 14
calls`). The chips and the rows always list everything with their own full figures, so a pick
never hides another pick. "Clear filters" sits under the totals line whenever a filter is on,
open or closed. While a filter is on, entries that are not model calls (delays, validations)
are hidden. The token types in the legend are not filters: nearly every call has input and
output, so they would not narrow anything.

The filter is `UsageFilter` in `usageSummary.ts`; the view's state is in
`src/views/logs/useLogUsage.ts`.

## Sorting the steps

The Step, Model, Calls, Tokens and Cost headings sort the table; the same heading again flips
the direction, and an arrow marks the heading in use. It starts largest first, cut to five
steps with "Show all". Any other order lists every step, so the largest is never hidden. A
step with no cost stays last in both directions. `sortSteps()` and `nextStepSort()` are in
`usageSummary.ts`. The order is not remembered between visits.

## The log's header

`src/views/logs/LogsHeader.tsx` holds the title, the actions on the whole log and the tabs.
Clear is the leftmost action and asks once on the button itself ("Clear all 25 entries?")
before it empties the log. The tabs are All, Calls, Errors, Validations and Audio; the last three appear only when the log
has entries of their kind. All five fit one row at 390px. There is no Delays tab: a wait
between retries only means something beside the call that caused it, and it is still listed
under All. Only Errors carries a count, capped at "99+".

## Calls logged before costs were kept

A cost is saved on the entry when its call finishes. Entries from an older build have none, but
they do carry provider, model and token counts, so `withLogCost()` prices them when the log is
shown, at today's prices. An entry with a cost on record is never repriced.

## Where a price comes from

`estimateCallCost` in `src/services/llm/callCost.ts` tries these in order:

1. **The provider's own charge.** OpenRouter returns `usage.cost` with every response. With a
   bring-your-own-key route the upstream provider's charge is added to OpenRouter's fee.
2. **The provider's model catalog**, as last fetched in Settings: OpenRouter (dollars per
   token) and nano-GPT (dollars per million, cache rates per thousand).
3. **The built-in list** in `src/config/pricing.ts`, for Anthropic and Gemini.

The cost is worked out once, when the call succeeds, and saved on the log entry as `costUsd`
and `costExact`. Later price changes do not rewrite old entries.

## The sum

`promptTokens` is everything sent, cached parts included. `costOfCall`
(`src/domain/story/callCost.ts`) bills cache reads and cache writes at their own rates and the
rest as plain input. Response tokens already include thinking on every provider except Gemini,
which reports thoughts apart, so they are added there (`thinkingBilledApart`).

Not counted: failed or stopped calls (no usage is reported), image and audio generation,
embeddings, batch or fast-mode pricing.

## Keeping the list current

`src/config/pricing.ts` has one row per model, in dollars per million tokens, plus
`PRICES_CHECKED_ON`, which the log shows in the tooltip. When a provider changes prices or
ships a model:

- add or edit the row from the provider's pricing page (links are at the top of the file),
- use `longPromptOver` + `long` for a higher rate on long prompts,
- use `next: { from, ... }` for a change that has been announced but not started,
- move `PRICES_CHECKED_ON`.

A model id matches its row exactly or as a dated or preview version of it
(`claude-haiku-4-5-20251001`, `gemini-3.1-pro-preview`). A sibling such as `-lite` never
matches, so a missing row shows no cost instead of a wrong one.

## Cache read and cache write

Every provider's counts are kept on the log entry as `cachedTokens` (read back from the
provider's prompt cache) and `cacheWriteTokens` (stored for later calls):

| Provider | Read | Write |
| --- | --- | --- |
| Anthropic | `cache_read_input_tokens` | `cache_creation_input_tokens` |
| OpenRouter, nano-GPT (OpenAI, DeepSeek and others) | `prompt_tokens_details.cached_tokens` | `prompt_tokens_details.cache_write_tokens` |
| Gemini | `cachedContentTokenCount` | none: implicit caching has no write step |

A call showing neither is normal. Claude only caches a marked part of at least 512 to 4096
tokens (it depends on the model), and only the system prompt and the scene-writing prompt are
marked (see `PROMPT_CACHE_ORDER.md`). A step whose prompt is different on every call, such as
distilling one lore section after another, has nothing to read back.

## The five parts of the bar

The parts do not overlap and add up to the total: plain input is the prompt minus its cached
parts, and output is the response minus thinking wherever the provider counts thinking inside
the response (`usagePartsOf`). Steps are grouped by log name with trailing counters removed
(`stepNameOf`), so "Lore Section Distiller 22/38" and "Writing Agent (Turn 2/8)" are one row
each. The bar's colours are `--usage-*` in `src/styles/tokens.css`; they are a checked
colour-blind-safe set, so change them as a set.
