/**
 * @module domain/story/usageSummary
 * Adds up the log's model calls for the usage summary: tokens split into five parts that do
 * not overlap, what the calls cost, and the same per pipeline step.
 */

import { MODEL_PRICES } from '@/config/pricing';
import { costOfLogEntry, type CostTotal } from './callCost';

/** In the order the bar draws them: what was sent, then what came back. */
export const USAGE_PARTS = ['input', 'cacheWrite', 'cacheRead', 'thinking', 'output'] as const;
export type UsagePart = (typeof USAGE_PARTS)[number];
export type UsageParts = Record<UsagePart, number>;

export interface UsageEntry {
    function?: string;
    provider?: string;
    promptTokens?: number | null;
    cachedTokens?: number | null;
    cacheWriteTokens?: number | null;
    responseTokens?: number | null;
    thinkingTokens?: number | null;
    reasoningTokensUsed?: number | null;
    costUsd?: number | null;
    costExact?: boolean;
}

export interface StepUsage {
    name: string;
    calls: number;
    tokens: number;
    cost: CostTotal | null;
    /** This step's share of all tokens, 0 to 1. */
    share: number;
}

export interface UsageSummary {
    parts: UsageParts;
    tokens: number;
    calls: number;
    cost: CostTotal | null;
    /** Largest first. */
    steps: StepUsage[];
}

const count = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * One call's tokens as five parts that add up to what was processed. The prompt count includes
 * its cached parts, and the response count includes thinking on every provider except the ones
 * that report thinking apart, so both are split here rather than counted twice.
 */
export function usagePartsOf(entry: UsageEntry): UsageParts {
    const prompt = count(entry.promptTokens);
    const cacheRead = Math.min(count(entry.cachedTokens), prompt);
    const cacheWrite = Math.min(count(entry.cacheWriteTokens), prompt - cacheRead);
    const response = count(entry.responseTokens);
    const reported = count(entry.thinkingTokens) || count(entry.reasoningTokensUsed);
    const apart = MODEL_PRICES[String(entry.provider || '').toLowerCase()]?.thinkingBilledApart === true;
    const thinking = apart ? reported : Math.min(reported, response);
    return {
        input: prompt - cacheRead - cacheWrite,
        cacheWrite,
        cacheRead,
        thinking,
        output: apart ? response : response - thinking
    };
}

/** "Lore Section Distiller 22/38" and "Writing Agent (Turn 2/8)" are one step each. */
export function stepNameOf(logName: string | undefined): string {
    let name = String(logName || '').trim();
    for (;;) {
        const shorter = name
            .replace(/\s*\((?=[^)]*\d)[^()]*\)$/, '')
            .replace(/\s+[A-Za-z]?\d[\d./]*$/, '')
            .trim();
        if (shorter === name || !shorter) break;
        name = shorter;
    }
    return name || 'Other';
}

function addCost(total: CostTotal | null, entry: UsageEntry): CostTotal | null {
    const cost = costOfLogEntry(entry);
    if (!cost) return total;
    return total
        ? { usd: total.usd + cost.usd, exact: total.exact && cost.exact, calls: total.calls + 1 }
        : { ...cost, calls: 1 };
}

/** The whole log's usage. Entries that used no tokens (delays, validations) are left out. */
export function summarizeUsage(entries: ReadonlyArray<UsageEntry>): UsageSummary {
    const parts: UsageParts = { input: 0, cacheWrite: 0, cacheRead: 0, thinking: 0, output: 0 };
    const byStep = new Map<string, Omit<StepUsage, 'share'>>();
    let tokens = 0;
    let calls = 0;
    let cost: CostTotal | null = null;

    for (const entry of entries) {
        const own = usagePartsOf(entry);
        const ownTokens = USAGE_PARTS.reduce((sum, part) => sum + own[part], 0);
        if (ownTokens <= 0) continue;
        for (const part of USAGE_PARTS) parts[part] += own[part];
        tokens += ownTokens;
        calls += 1;
        cost = addCost(cost, entry);

        const name = stepNameOf(entry.function);
        const step = byStep.get(name) || { name, calls: 0, tokens: 0, cost: null };
        byStep.set(name, {
            name,
            calls: step.calls + 1,
            tokens: step.tokens + ownTokens,
            cost: addCost(step.cost, entry)
        });
    }

    const steps = [...byStep.values()]
        .map((step) => ({ ...step, share: tokens > 0 ? step.tokens / tokens : 0 }))
        .sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name));
    return { parts, tokens, calls, cost, steps };
}

/** "842", "308.1K", "11.6M": short enough to sit in a legend or a table column. */
export function formatTokenCount(tokens: number): string {
    const n = Math.max(0, Math.round(tokens));
    if (n < 1000) return String(n);
    const short = (value: number, unit: string): string =>
        `${value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')}${unit}`;
    return n < 999_500 ? short(n / 1000, 'K') : short(n / 1_000_000, 'M');
}

/** "24%", or "<1%" for a share that would round to nothing. */
export function formatShare(share: number): string {
    if (share <= 0) return '0%';
    return share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`;
}
