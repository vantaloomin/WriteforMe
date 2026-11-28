/**
 * @module domain/story/usageSummary
 * Adds up the log's model calls for the usage summary: tokens split into five parts that do
 * not overlap, what the calls cost, and the same per pipeline step and per model. Also the
 * filter the summary puts on the log: any mix of steps and models.
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
    modelUsed?: string;
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
    /** The models that ran this step, most used first. */
    models: string[];
}

export interface ModelUsage {
    name: string;
    calls: number;
    tokens: number;
    cost: CostTotal | null;
}

export interface UsageSummary {
    parts: UsageParts;
    tokens: number;
    calls: number;
    cost: CostTotal | null;
    /** Largest first. */
    steps: StepUsage[];
    /** Largest first. */
    models: ModelUsage[];
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

/** The model a call ran on, as the provider named it. */
export function modelNameOf(entry: UsageEntry): string {
    return String(entry.modelUsed || '').trim() || 'Unknown model';
}

const tokensOf = (parts: UsageParts): number => USAGE_PARTS.reduce((sum, part) => sum + parts[part], 0);

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
    const byStep = new Map<string, Omit<StepUsage, 'share' | 'models'> & { models: Map<string, number> }>();
    const byModel = new Map<string, ModelUsage>();
    let tokens = 0;
    let calls = 0;
    let cost: CostTotal | null = null;

    for (const entry of entries) {
        const own = usagePartsOf(entry);
        const ownTokens = tokensOf(own);
        if (ownTokens <= 0) continue;
        for (const part of USAGE_PARTS) parts[part] += own[part];
        tokens += ownTokens;
        calls += 1;
        cost = addCost(cost, entry);

        const modelName = modelNameOf(entry);
        const model = byModel.get(modelName) || { name: modelName, calls: 0, tokens: 0, cost: null };
        byModel.set(modelName, {
            name: modelName,
            calls: model.calls + 1,
            tokens: model.tokens + ownTokens,
            cost: addCost(model.cost, entry)
        });

        const name = stepNameOf(entry.function);
        const step = byStep.get(name) || { name, calls: 0, tokens: 0, cost: null, models: new Map() };
        step.models.set(modelName, (step.models.get(modelName) || 0) + ownTokens);
        byStep.set(name, {
            name,
            calls: step.calls + 1,
            tokens: step.tokens + ownTokens,
            cost: addCost(step.cost, entry),
            models: step.models
        });
    }

    const largestFirst = (a: { tokens: number; name: string }, b: { tokens: number; name: string }): number =>
        b.tokens - a.tokens || a.name.localeCompare(b.name);
    const steps = [...byStep.values()]
        .map((step) => ({
            ...step,
            share: tokens > 0 ? step.tokens / tokens : 0,
            models: [...step.models.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
        }))
        .sort(largestFirst);
    return { parts, tokens, calls, cost, steps, models: [...byModel.values()].sort(largestFirst) };
}

export const STEP_SORT_KEYS = ['name', 'model', 'calls', 'tokens', 'cost'] as const;
export type StepSortKey = (typeof STEP_SORT_KEYS)[number];
export interface StepSort {
    key: StepSortKey;
    descending: boolean;
}

/** How the table starts: the step that used the most first. */
export const DEFAULT_STEP_SORT: StepSort = { key: 'tokens', descending: true };

/** The same column again flips the direction; a new column starts where it reads best. */
export function nextStepSort(current: StepSort, key: StepSortKey): StepSort {
    if (current.key === key) return { key, descending: !current.descending };
    return { key, descending: key !== 'name' && key !== 'model' };
}

/** What the Model column shows for a step: its one model, or how many it ran on. */
export function stepModelLabel(step: StepUsage): string {
    return step.models.length === 1 ? step.models[0] : `${step.models.length} models`;
}

/**
 * Steps in the chosen order. A step with no cost goes last in both directions, since a blank
 * means unknown or local, not cheapest. Ties fall back to largest first.
 */
export function sortSteps(steps: ReadonlyArray<StepUsage>, sort: StepSort): StepUsage[] {
    const text = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: 'base' });
    const direction = sort.descending ? -1 : 1;
    const compare = (a: StepUsage, b: StepUsage): number => {
        if (sort.key === 'name') return direction * text(a.name, b.name);
        if (sort.key === 'model') return direction * text(stepModelLabel(a), stepModelLabel(b));
        if (sort.key === 'calls') return direction * (a.calls - b.calls);
        if (sort.key === 'cost') {
            if (!a.cost || !b.cost) return Number(!a.cost) - Number(!b.cost);
            return direction * (a.cost.usd - b.cost.usd);
        }
        return direction * (a.tokens - b.tokens);
    };
    return [...steps].sort((a, b) => compare(a, b) || b.tokens - a.tokens || text(a.name, b.name));
}

/** What the reader picked in the summary. An empty list means "any". */
export interface UsageFilter {
    steps: string[];
    models: string[];
}
export type UsageFilterKind = keyof UsageFilter;

export const NO_USAGE_FILTER: UsageFilter = { steps: [], models: [] };

export function isUsageFilterActive(filter: UsageFilter): boolean {
    return filter.steps.length + filter.models.length > 0;
}

/** Adds the value to its list, or takes it out if it is already there. */
export function toggleUsageFilter(filter: UsageFilter, kind: UsageFilterKind, value: string): UsageFilter {
    const list = filter[kind];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    return { ...filter, [kind]: next };
}

/**
 * True when the entry passes the filter. With nothing picked every entry passes; once
 * something is picked only model calls can, so delays and validations drop out of the list.
 * Picks of one kind add up (either step); the two kinds narrow each other.
 */
export function matchesUsageFilter(entry: UsageEntry, filter: UsageFilter): boolean {
    if (!isUsageFilterActive(filter)) return true;
    if (tokensOf(usagePartsOf(entry)) <= 0) return false;
    if (filter.steps.length > 0 && !filter.steps.includes(stepNameOf(entry.function))) return false;
    return filter.models.length === 0 || filter.models.includes(modelNameOf(entry));
}

export interface FilteredUsage {
    /** Every model call in the log. The model and step lists show these, so they never move. */
    all: UsageSummary;
    /** The calls that pass the filter: the totals line and the bar. */
    shown: UsageSummary;
}

export function filterUsage(entries: ReadonlyArray<UsageEntry>, filter: UsageFilter): FilteredUsage {
    const all = summarizeUsage(entries);
    if (!isUsageFilterActive(filter)) return { all, shown: all };
    return { all, shown: summarizeUsage(entries.filter((entry) => matchesUsageFilter(entry, filter))) };
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
