# Call costs in the log

Each finished model call in the log shows what it cost, and the header shows the total for the
entries in the log. `≈ $0.076` is an estimate (tokens times a list price); a bare `$0.0041` is
the charge the provider reported. Local providers (KoboldCPP, the Claude Code and Codex
bridges), free models and models nobody has a price for show nothing.

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
