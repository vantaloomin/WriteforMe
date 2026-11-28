/**
 * @module config/pricing
 * List prices for the cloud providers that do not publish them through an API the app already
 * calls (Anthropic and Gemini). OpenRouter and nano-GPT prices come from their own model
 * catalogs instead, so they are not kept here. Used only to show an approximate cost in the
 * log; nothing is billed or blocked from these numbers.
 *
 * To update: read the two pricing pages below, change the rows, and move the date.
 *   https://platform.claude.com/docs/en/about-claude/pricing
 *   https://ai.google.dev/gemini-api/docs/pricing
 */

/** The day these rows were last read against the providers' pricing pages. */
export const PRICES_CHECKED_ON = '2026-11-28';

/** US dollars per million tokens. */
export interface ModelPrice {
    input: number;
    /** Response tokens, thinking included. */
    output: number;
    /** Input read back from the prompt cache. Defaults to the provider's usual share of `input`. */
    cacheRead?: number;
    /** Input written to the prompt cache. Defaults to the provider's usual multiple of `input`. */
    cacheWrite?: number;
}

export interface PricedModel extends ModelPrice {
    /** A prompt with more tokens than this is billed at the `long` rates. */
    longPromptOver?: number;
    long?: ModelPrice;
    /** A price change the provider has already announced, taking effect on `from` (ISO date). */
    next?: ModelPrice & { from: string };
}

export interface ProviderPriceList {
    /** Cache read price as a share of input, where a row gives none. */
    cacheReadShare: number;
    /** Cache write price as a multiple of input, where a row gives none. */
    cacheWriteMultiple: number;
    /** True when the provider counts thinking tokens apart from response tokens. */
    thinkingBilledApart: boolean;
    models: Readonly<Record<string, PricedModel>>;
}

export const MODEL_PRICES: Readonly<Record<string, ProviderPriceList>> = {
    anthropic: {
        cacheReadShare: 0.1,
        // The app writes five-minute cache entries, which cost 1.25 times the input price.
        cacheWriteMultiple: 1.25,
        thinkingBilledApart: false,
        models: {
            'claude-fable-5-2': { input: 8, output: 40, cacheRead: 0.2 },
            'claude-mythos-5-2': { input: 8, output: 40, cacheRead: 0.2 },
            'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
            'claude-mythos-5-1': { input: 10, output: 50, cacheRead: 0.25 },
            'claude-fable-5': { input: 10, output: 50, cacheRead: 1 },
            'claude-mythos-5': { input: 10, output: 50, cacheRead: 1 },
            'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
            'claude-opus-5': { input: 5, output: 25 },
            'claude-opus-4-8': { input: 5, output: 25 },
            'claude-opus-4-7': { input: 5, output: 25 },
            'claude-opus-4-6': { input: 5, output: 25 },
            'claude-opus-4-5': { input: 5, output: 25 },
            'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1 },
            'claude-sonnet-5': { input: 2, output: 10 },
            'claude-sonnet-4-6': { input: 3, output: 15 },
            'claude-sonnet-4-5': { input: 3, output: 15 },
            'claude-haiku-5-5': {
                input: 0.1,
                output: 0.5,
                longPromptOver: 100_000,
                long: { input: 0.5, output: 2.5 }
            },
            'claude-haiku-4-5': { input: 1, output: 5 }
        }
    },
    gemini: {
        cacheReadShare: 0.1,
        // Implicit caching has no write fee: the first pass is billed as plain input.
        cacheWriteMultiple: 1,
        // candidatesTokenCount leaves thoughts out; both are billed at the output price.
        thinkingBilledApart: true,
        models: {
            'gemini-3.8-flash': {
                input: 0.75,
                output: 3.75,
                next: { from: '2027-01-01', input: 1.5, output: 7.5 }
            },
            // Requests to 3.7 Flash are served by 3.8 Flash.
            'gemini-3.7-flash': {
                input: 0.75,
                output: 3.75,
                next: { from: '2027-01-01', input: 1.5, output: 7.5 }
            },
            'gemini-3.6-flash': { input: 1.5, output: 7.5 },
            'gemini-3.5-flash': { input: 1.5, output: 9 },
            'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
            'gemini-3.1-pro': {
                input: 2,
                output: 12,
                longPromptOver: 200_000,
                long: { input: 4, output: 18 }
            },
            'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
            'gemini-3-flash': { input: 0.5, output: 3 },
            'gemini-2.5-pro': {
                input: 1.25,
                output: 10,
                longPromptOver: 200_000,
                long: { input: 2.5, output: 15 }
            },
            'gemini-2.5-flash': { input: 0.3, output: 2.5 },
            'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 }
        }
    }
};
