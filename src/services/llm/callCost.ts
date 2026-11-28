/**
 * @module services/llm/callCost
 * Prices one finished model call for the log. Sources, best first:
 *   1. the charge the provider reported with the response (OpenRouter),
 *   2. the provider's own model catalog, as last fetched in Settings (OpenRouter, nano-GPT),
 *   3. the built-in list in `config/pricing` (Anthropic, Gemini).
 * Local providers, free models and models none of these know give null, and the log shows
 * nothing rather than a guess.
 */

import { STORAGE_KEYS } from '@/config';
import {
    costOfCall,
    isModelVersionOf,
    listPriceFor,
    type CallCost,
    type CallUsage,
    type ResolvedPrice
} from '@/domain/story/callCost';
import { isLocalProvider } from '@/types';

export interface PricedCall extends CallUsage {
    provider: string;
    model: string;
    /** Dollars the provider says it charged for this call, when it says. */
    reportedCost?: number | null;
}

const rate = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
};

function readCatalog(storageKey: string): Array<Record<string, unknown>> {
    try {
        const raw =
            (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(storageKey)) ||
            (typeof localStorage !== 'undefined' && localStorage.getItem(storageKey));
        const list: unknown = raw ? JSON.parse(raw) : null;
        return Array.isArray(list)
            ? list.filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object')
            : [];
    } catch {
        return [];
    }
}

function catalogPricing(storageKey: string, model: string): Record<string, unknown> | null {
    const id = model.trim().toLowerCase();
    const catalog = readCatalog(storageKey);
    const idOf = (m: Record<string, unknown>): string => String(m.id || '').toLowerCase();
    // A response can name a dated snapshot ("vendor/model-20260101") of the catalog's model.
    const found =
        catalog.find((m) => idOf(m) === id) || catalog.find((m) => isModelVersionOf(id, idOf(m)));
    const pricing = found?.pricing;
    return pricing && typeof pricing === 'object' ? (pricing as Record<string, unknown>) : null;
}

/** OpenRouter lists dollars per single token, as strings. */
function openRouterPrice(model: string): ResolvedPrice | null {
    const pricing = catalogPricing(STORAGE_KEYS.openRouterModelsCache, model);
    const input = rate(pricing?.prompt);
    const output = rate(pricing?.completion);
    if (!pricing || input === null || output === null) return null;
    const perMillion = (n: number): number => n * 1_000_000;
    return {
        input: perMillion(input),
        output: perMillion(output),
        cacheRead: perMillion(rate(pricing.input_cache_read) ?? input),
        cacheWrite: perMillion(rate(pricing.input_cache_write) ?? input),
        thinkingBilledApart: false
    };
}

/** nano-GPT lists dollars per million tokens, and its cache rates per thousand. */
function nanoGptPrice(model: string): ResolvedPrice | null {
    const pricing = catalogPricing(STORAGE_KEYS.nanoGptModelsCache, model);
    const input = rate(pricing?.prompt);
    const output = rate(pricing?.completion);
    if (!pricing || input === null || output === null) return null;
    const perThousand = (value: unknown): number | null => {
        const n = rate(value);
        return n === null ? null : n * 1000;
    };
    return {
        input,
        output,
        cacheRead: perThousand(pricing.cacheReadInputPer1kTokens) ?? input,
        cacheWrite: perThousand(pricing.cacheWriteInputPer1kTokens) ?? input,
        thinkingBilledApart: false
    };
}

/** What a finished call cost, or null when it was free, local or cannot be priced. */
export function estimateCallCost(call: PricedCall, now: number = Date.now()): CallCost | null {
    if (isLocalProvider(call.provider)) return null;
    const reported = rate(call.reportedCost);
    if (reported !== null) return reported > 0 ? { usd: reported, exact: true } : null;

    const price =
        call.provider === 'openrouter'
            ? openRouterPrice(call.model)
            : call.provider === 'nanogpt'
              ? nanoGptPrice(call.model)
              : listPriceFor(call.provider, call.model, call.promptTokens, now);
    if (!price) return null;
    const usd = costOfCall(price, call);
    return usd === null ? null : { usd, exact: false };
}

/** The two fields a log entry keeps for its cost. */
export function costLogFields(call: PricedCall): { costUsd: number | null; costExact: boolean } {
    const cost = estimateCallCost(call);
    return { costUsd: cost ? cost.usd : null, costExact: cost ? cost.exact : false };
}

/**
 * A log entry with its cost filled in when it has none on record. Calls logged before the app
 * kept costs still carry their provider, model and token counts, so they are priced when shown,
 * at today's prices. An entry that already has a cost, or a null one, is returned as it is.
 */
export function withLogCost<
    T extends CallUsage & {
        provider?: string;
        modelUsed?: string;
        status?: string;
        costUsd?: unknown;
        reasoningTokensUsed?: number | null;
    }
>(entry: T): T {
    if (entry.costUsd !== undefined || entry.status !== 'success') return entry;
    if (!entry.provider || !entry.modelUsed) return entry;
    return {
        ...entry,
        ...costLogFields({
            ...entry,
            provider: entry.provider,
            model: entry.modelUsed,
            thinkingTokens: entry.thinkingTokens ?? entry.reasoningTokensUsed
        })
    };
}
