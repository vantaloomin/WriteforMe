/**
 * @module domain/story/callCost
 * What one model call cost, worked out from its token counts and a price per million tokens.
 * Pure: where the price comes from (a provider's own bill, its catalog, or the built-in list)
 * is decided in `services/llm/callCost`.
 */

import { MODEL_PRICES, type ModelPrice, type ProviderPriceList } from '@/config/pricing';

export interface CallUsage {
    promptTokens?: number | null;
    cachedTokens?: number | null;
    cacheWriteTokens?: number | null;
    responseTokens?: number | null;
    thinkingTokens?: number | null;
}

export interface CallCost {
    usd: number;
    /** True when the provider reported the charge itself; false when it is tokens times a list price. */
    exact: boolean;
}

/** A price with every rate filled in, ready to multiply. */
export interface ResolvedPrice {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    thinkingBilledApart: boolean;
}

const count = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/** A dated snapshot (`-20251001`), `-latest`, `-preview...` or `-001` after a known model id. */
const VERSION_SUFFIX = /^[-@](\d{8}|\d{4}-\d{2}-\d{2}|\d{3}|latest|preview(-[\w.-]+)?)$/;

/** True when `id` is `known` itself or a dated or preview version of it, never a sibling model. */
export function isModelVersionOf(id: string, known: string): boolean {
    if (!known || !id.startsWith(known)) return false;
    return id.length === known.length || VERSION_SUFFIX.test(id.slice(known.length));
}

function fill(price: ModelPrice, list: ProviderPriceList): ResolvedPrice {
    return {
        input: price.input,
        output: price.output,
        cacheRead: price.cacheRead ?? price.input * list.cacheReadShare,
        cacheWrite: price.cacheWrite ?? price.input * list.cacheWriteMultiple,
        thinkingBilledApart: list.thinkingBilledApart
    };
}

/** The built-in list price for a model, or null for a provider or model the list does not hold. */
export function listPriceFor(
    provider: string,
    model: string,
    promptTokens: number | null | undefined = 0,
    now: number = Date.now()
): ResolvedPrice | null {
    const list = MODEL_PRICES[provider];
    if (!list) return null;
    const id = String(model || '')
        .trim()
        .toLowerCase()
        .replace(/^models\//, '');
    if (!id) return null;
    const key = id in list.models ? id : Object.keys(list.models).find((k) => isModelVersionOf(id, k));
    if (!key) return null;
    const row = list.models[key];
    if (row.next && now >= Date.parse(row.next.from)) return fill(row.next, list);
    if (row.long && row.longPromptOver && count(promptTokens) > row.longPromptOver) {
        return fill(row.long, list);
    }
    return fill(row, list);
}

/**
 * Tokens times price. `promptTokens` is everything sent, cached parts included, which is how
 * every provider in the app reports it; the cached parts are moved to their own rates here.
 * Null when there is nothing to charge for.
 */
export function costOfCall(price: ResolvedPrice, usage: CallUsage): number | null {
    const prompt = count(usage.promptTokens);
    const cacheRead = Math.min(count(usage.cachedTokens), prompt);
    const cacheWrite = Math.min(count(usage.cacheWriteTokens), prompt - cacheRead);
    const plain = prompt - cacheRead - cacheWrite;
    const output =
        count(usage.responseTokens) + (price.thinkingBilledApart ? count(usage.thinkingTokens) : 0);
    const usd =
        (plain * price.input +
            cacheRead * price.cacheRead +
            cacheWrite * price.cacheWrite +
            output * price.output) /
        1_000_000;
    return usd > 0 ? usd : null;
}

/** "$1.24", "$0.042", "$0.0031". Small amounts keep more places so they do not read as zero. */
export function formatUsd(usd: number): string {
    if (usd >= 1) return `$${usd.toFixed(2)}`;
    if (usd >= 0.01) return `$${usd.toFixed(3)}`;
    if (usd >= 0.0001) return `$${usd.toFixed(4)}`;
    return '<$0.0001';
}

/** "≈ $0.042" for an estimate, "$0.042" for a charge the provider reported. */
export function formatCallCost(cost: CallCost): string {
    return cost.exact ? formatUsd(cost.usd) : `≈ ${formatUsd(cost.usd)}`;
}

/** The cost saved on a log entry, or null when the call was free, local or could not be priced. */
export function costOfLogEntry(entry: { costUsd?: unknown; costExact?: unknown }): CallCost | null {
    const usd = Number(entry.costUsd);
    if (!Number.isFinite(usd) || usd <= 0) return null;
    return { usd, exact: entry.costExact === true };
}

export interface CostTotal extends CallCost {
    /** How many entries the total covers. */
    calls: number;
}

/** Adds up the entries that have a cost. The total is exact only if every part of it is. */
export function sumLogCosts(
    entries: ReadonlyArray<{ costUsd?: unknown; costExact?: unknown }>
): CostTotal | null {
    let usd = 0;
    let calls = 0;
    let exact = true;
    for (const entry of entries) {
        const cost = costOfLogEntry(entry);
        if (!cost) continue;
        usd += cost.usd;
        calls += 1;
        exact = exact && cost.exact;
    }
    return calls > 0 ? { usd, exact, calls } : null;
}
