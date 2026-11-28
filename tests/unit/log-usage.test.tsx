import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    formatShare,
    formatTokenCount,
    DEFAULT_STEP_SORT,
    filterUsage,
    formatVerboseLogEntry,
    matchesUsageFilter,
    nextStepSort,
    NO_USAGE_FILTER,
    sortSteps,
    stepNameOf,
    summarizeUsage,
    toggleUsageFilter,
    usagePartsOf,
    type UsageFilter
} from '@/domain/story';
import { withLogCost } from '@/services/llm';
import { LogCacheTokens } from '@/views/logs/LogCallFigures';
import { LogUsage } from '@/views/logs/LogUsage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const claude = (over: Record<string, unknown> = {}) => ({
    function: 'Lore Section Distiller 21/38',
    provider: 'anthropic',
    modelUsed: 'claude-opus-5-5',
    promptTokens: 10_000,
    cachedTokens: 6_000,
    cacheWriteTokens: 1_000,
    responseTokens: 2_000,
    thinkingTokens: 500,
    costUsd: 0.05,
    costExact: false,
    ...over
});

describe('usagePartsOf', () => {
    it('splits a prompt into plain input, cache write and cache read without overlap', () => {
        expect(usagePartsOf(claude())).toEqual({
            input: 3_000,
            cacheWrite: 1_000,
            cacheRead: 6_000,
            thinking: 500,
            output: 1_500
        });
    });

    it('adds thinking on top of the response only where the provider reports it apart', () => {
        const parts = usagePartsOf({ provider: 'gemini', promptTokens: 100, responseTokens: 40, thinkingTokens: 60 });
        expect(parts.thinking).toBe(60);
        expect(parts.output).toBe(40);
    });

    it('never goes negative on odd counts', () => {
        const parts = usagePartsOf({ promptTokens: 100, cachedTokens: 900, cacheWriteTokens: 50, responseTokens: 10, thinkingTokens: 80 });
        expect(parts).toEqual({ input: 0, cacheWrite: 0, cacheRead: 100, thinking: 10, output: 0 });
    });
});

describe('stepNameOf', () => {
    it('drops counters so repeated calls are one step', () => {
        expect(stepNameOf('Lore Section Distiller 22/38')).toBe('Lore Section Distiller');
        expect(stepNameOf('Lore Cluster Synthesizer L3.2')).toBe('Lore Cluster Synthesizer');
        expect(stepNameOf('Writing Agent (Turn 2/8)')).toBe('Writing Agent');
        expect(stepNameOf('Surgical Editor (AI Slop) (Pass 1/2, Attempt 2/3)')).toBe('Surgical Editor (AI Slop)');
        expect(stepNameOf('')).toBe('Other');
    });
});

describe('summarizeUsage', () => {
    it('totals parts, cost and steps, and skips entries that used no tokens', () => {
        const usage = summarizeUsage([
            claude(),
            claude({ function: 'Lore Section Distiller 22/38', costExact: true }),
            claude({ function: 'Review', promptTokens: 1_000, cachedTokens: 0, cacheWriteTokens: 0, responseTokens: 200, thinkingTokens: 0, costUsd: null }),
            { function: 'Delay' }
        ]);
        expect(usage.calls).toBe(3);
        expect(usage.tokens).toBe(12_000 * 2 + 1_200);
        expect(usage.parts.cacheRead).toBe(12_000);
        expect(usage.parts.cacheWrite).toBe(2_000);
        expect(usage.cost).toEqual({ usd: 0.1, exact: false, calls: 2 });
        expect(usage.steps.map((s) => [s.name, s.calls])).toEqual([
            ['Lore Section Distiller', 2],
            ['Review', 1]
        ]);
        expect(usage.steps[1].cost).toBeNull();
        expect(usage.steps[0].share + usage.steps[1].share).toBeCloseTo(1);
    });
});

describe('formatting', () => {
    it('shortens token counts', () => {
        expect(formatTokenCount(842)).toBe('842');
        expect(formatTokenCount(308_100)).toBe('308K');
        expect(formatTokenCount(41_800)).toBe('41.8K');
        expect(formatTokenCount(2_000)).toBe('2K');
        expect(formatTokenCount(11_600_000)).toBe('11.6M');
        expect(formatTokenCount(999_900)).toBe('1M');
    });

    it('keeps a tiny share from reading as zero', () => {
        expect(formatShare(0.24)).toBe('24%');
        expect(formatShare(0.001)).toBe('<1%');
        expect(formatShare(0)).toBe('0%');
    });

    it('lists cache reads and writes in the exported dossier', () => {
        const text = formatVerboseLogEntry(claude());
        expect(text).toContain('Read From Cache:        6,000');
        expect(text).toContain('Written To Cache:       1,000');
        expect(formatVerboseLogEntry(claude({ cachedTokens: 0, cacheWriteTokens: null }))).not.toContain('Cache:');
    });
});

describe('usage filter', () => {
    const log = [
        claude({ function: 'Lore Section Distiller 1/2' }),
        claude({ function: 'Lore Section Distiller 2/2', cachedTokens: 0, cacheWriteTokens: 0 }),
        claude({ function: 'Review', modelUsed: 'claude-sonnet-5-5', promptTokens: 4_000, cachedTokens: 0, cacheWriteTokens: 0 }),
        { function: 'Delay' }
    ];
    const pick = (kind: keyof UsageFilter, value: string): UsageFilter =>
        toggleUsageFilter(NO_USAGE_FILTER, kind, value);

    it('lists models and each step\'s models', () => {
        const usage = summarizeUsage(log);
        expect(usage.models.map((m) => [m.name, m.calls])).toEqual([
            ['claude-opus-5-5', 2],
            ['claude-sonnet-5-5', 1]
        ]);
        expect(usage.steps[0].models).toEqual(['claude-opus-5-5']);
        expect(summarizeUsage([claude({ modelUsed: '' })]).models[0].name).toBe('Unknown model');
    });

    it('toggles a value in and out', () => {
        const picked = pick('steps', 'Review');
        expect(picked.steps).toEqual(['Review']);
        expect(toggleUsageFilter(picked, 'steps', 'Review')).toEqual(NO_USAGE_FILTER);
    });

    it('lets everything through when empty, and only matching model calls otherwise', () => {
        expect(log.every((entry) => matchesUsageFilter(entry, NO_USAGE_FILTER))).toBe(true);
        const matching = (filter: UsageFilter): number => log.filter((e) => matchesUsageFilter(e, filter)).length;
        expect(matching(pick('models', 'claude-sonnet-5-5'))).toBe(1);
        expect(matching(pick('steps', 'Lore Section Distiller'))).toBe(2);
        expect(matching({ steps: ['Review'], models: ['claude-opus-5-5'] })).toBe(0);
        expect(matching({ steps: ['Review', 'Lore Section Distiller'], models: [] })).toBe(3);
    });

    it('narrows the totals and leaves the lists whole, so a pick cannot hide another', () => {
        const usage = filterUsage(log, { steps: ['Review'], models: ['claude-sonnet-5-5'] });
        expect(usage.shown.calls).toBe(1);
        expect(usage.all.calls).toBe(3);
        expect(usage.all.models).toHaveLength(2);
        expect(usage.all.steps).toHaveLength(2);
    });
});

describe('step sorting', () => {
    const steps = summarizeUsage([
        claude({ function: 'beta', promptTokens: 30_000, costUsd: 0.1 }),
        claude({ function: 'Alpha', costUsd: 0.9 }),
        claude({ function: 'Alpha', costUsd: 0.9 }),
        claude({ function: 'Gamma', promptTokens: 1_000, cachedTokens: 0, cacheWriteTokens: 0, costUsd: null, provider: 'koboldcpp' })
    ]).steps;
    const names = (sort: Parameters<typeof sortSteps>[1]): string[] => sortSteps(steps, sort).map((s) => s.name);

    it('starts largest first and sorts each column both ways', () => {
        expect(names(DEFAULT_STEP_SORT)).toEqual(['beta', 'Alpha', 'Gamma']);
        expect(names({ key: 'name', descending: false })).toEqual(['Alpha', 'beta', 'Gamma']);
        expect(names({ key: 'name', descending: true })).toEqual(['Gamma', 'beta', 'Alpha']);
        expect(names({ key: 'calls', descending: true })).toEqual(['Alpha', 'beta', 'Gamma']);
        expect(names({ key: 'cost', descending: true })).toEqual(['Alpha', 'beta', 'Gamma']);
        expect(names({ key: 'cost', descending: false })).toEqual(['Gamma', 'beta', 'Alpha']);
    });

    it('flips the direction on the same column and starts a new one where it reads best', () => {
        expect(nextStepSort(DEFAULT_STEP_SORT, 'tokens')).toEqual({ key: 'tokens', descending: false });
        expect(nextStepSort(DEFAULT_STEP_SORT, 'name')).toEqual({ key: 'name', descending: false });
        expect(nextStepSort({ key: 'name', descending: false }, 'cost')).toEqual({ key: 'cost', descending: true });
    });
});

describe('withLogCost', () => {
    const old = { status: 'success', provider: 'anthropic', modelUsed: 'claude-opus-5-5', promptTokens: 1_000_000, responseTokens: 0 };

    it('prices an entry that was logged without a cost', () => {
        expect(withLogCost(old)).toMatchObject({ costUsd: 4, costExact: false });
    });

    it('leaves alone an entry with a cost on record, a null one, a failed call and a local one', () => {
        expect(withLogCost({ ...old, costUsd: 1 }).costUsd).toBe(1);
        expect(withLogCost({ ...old, costUsd: null }).costUsd).toBeNull();
        expect(withLogCost({ ...old, status: 'error' })).not.toHaveProperty('costUsd');
        expect(withLogCost({ ...old, provider: 'koboldcpp' })).toMatchObject({ costUsd: null });
    });
});

describe('log usage views', () => {
    let container: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });
    const text = (testId: string): string | undefined =>
        container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? undefined;

    it('shows cache read and cache write as separate figures on a call', () => {
        act(() => root.render(<LogCacheTokens entry={claude()} />));
        expect(text('log-entry-cache-read')).toBe('Cache read: 6,000 (60%)');
        expect(text('log-entry-cache-write')).toBe('Cache write: 1,000 (10%)');
        act(() => root.render(<LogCacheTokens entry={claude({ cachedTokens: 0, cacheWriteTokens: null })} />));
        expect(container.textContent).toBe('');
    });

    const toggle = (): void => click('[data-testid="log-usage-toggle"]');
    const click = (selector: string): void => {
        const target = container.querySelector(selector);
        act(() => target?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };

    it('starts closed with the totals and the bar, opens on a click and remembers it', () => {
        localStorage.clear();
        act(() => root.render(<LogUsage entries={[claude()]} />));
        expect(text('log-total-cost')).toBe('≈ $0.050');
        expect(container.querySelector('[role="img"]')).not.toBeNull();
        expect(container.querySelector('table')).toBeNull();
        toggle();
        expect(container.querySelector('table')).not.toBeNull();

        act(() => root.render(<div />));
        act(() => root.render(<LogUsage entries={[claude()]} />));
        expect(container.querySelector('table')).not.toBeNull();
        toggle();
        expect(container.querySelector('table')).toBeNull();
    });

    it('draws the summary with a legend, the models, a cost and the steps', () => {
        localStorage.clear();
        const entries = Array.from({ length: 7 }, (_, i) => claude({ function: `Step ${String.fromCharCode(65 + i)} 1/2` }));
        act(() => root.render(<LogUsage entries={entries} />));
        toggle();
        expect(text('log-usage-cacheRead')).toBe('42K');
        expect(text('log-usage-cacheWrite')).toBe('7K');
        expect(text('log-total-cost')).toBe('≈ $0.350');
        expect(text('log-usage-models')).toContain('claude-opus-5-5');
        expect(container.querySelector('thead')?.textContent).not.toContain('Model');
        expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
        expect(text('log-usage-more')).toBe('Show all 7 steps');
        click('[data-testid="log-usage-more"]');
        expect(container.querySelectorAll('tbody tr')).toHaveLength(7);
    });

    it('filters by a clicked step and model, marks them, keeps every row, and clears while closed', () => {
        localStorage.clear();
        const entries = [
            claude({ function: 'Review', modelUsed: 'vendor/small-model' }),
            claude({ function: 'Planner' }),
            claude({ function: 'Planner' })
        ];
        function Host() {
            const [filter, setFilter] = useState(NO_USAGE_FILTER);
            return <LogUsage entries={entries} filter={filter} onFilter={setFilter} />;
        }
        act(() => root.render(<Host />));
        toggle();
        expect(text('log-usage-calls')).toContain('in 3 calls');
        expect(text('log-usage-clear')).toBeUndefined();
        expect(text('log-usage-models')).toContain('small-model');
        expect(text('log-usage-models')).not.toContain('vendor/');

        click('tbody tr:nth-child(2) button');
        expect(text('log-usage-calls')).toContain('in 1 of 3 calls');
        expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
        expect(container.querySelector('tbody tr:nth-child(2) button')?.getAttribute('aria-pressed')).toBe('true');
        expect(container.querySelector('tbody tr:nth-child(1)')?.className).toContain('opacity-60');
        // The first row keeps its own, unfiltered figure.
        expect(container.querySelector('tbody tr:nth-child(1)')?.textContent).toContain('24K');

        click('[data-testid="log-usage-models"] li:nth-child(1) button');
        expect(text('log-usage-calls')).toContain('in 0 of 3 calls');
        expect(container.querySelectorAll('[data-testid="log-usage-models"] li')).toHaveLength(2);

        toggle();
        click('[data-testid="log-usage-clear"]');
        expect(text('log-usage-calls')).toContain('in 3 calls');
    });

    it('sorts the table when a column heading is clicked, and marks the column', () => {
        localStorage.clear();
        const entries = [claude({ function: 'Zeta' }), claude({ function: 'Alpha', promptTokens: 90_000 })];
        act(() => root.render(<LogUsage entries={entries} />));
        toggle();
        const first = (): string | null | undefined => container.querySelector('tbody tr td')?.textContent;
        const sortOf = (key: string): string | null | undefined =>
            container.querySelector(`[data-testid="log-usage-sort-${key}"]`)?.closest('th')?.getAttribute('aria-sort');
        expect(first()).toBe('Alpha');
        expect(sortOf('tokens')).toBe('descending');
        click('[data-testid="log-usage-sort-tokens"]');
        expect(first()).toBe('Zeta');
        expect(sortOf('tokens')).toBe('ascending');
        click('[data-testid="log-usage-sort-name"]');
        expect(first()).toBe('Alpha');
        expect(sortOf('name')).toBe('ascending');
        expect(sortOf('tokens')).toBeNull();
    });

    it('shows the Model column only when more than one model ran', () => {
        localStorage.clear();
        act(() => root.render(<LogUsage entries={[claude(), claude({ modelUsed: 'other' })]} />));
        toggle();
        expect(container.querySelector('thead')?.textContent).toContain('Model');
    });

    it('leaves out the cost column when nothing is priced, and draws nothing for an empty log', () => {
        localStorage.clear();
        act(() => root.render(<LogUsage entries={[claude({ provider: 'koboldcpp', costUsd: null })]} />));
        toggle();
        expect(container.querySelectorAll('thead th')).toHaveLength(4);
        expect(text('log-total-cost')).toBeUndefined();
        act(() => root.render(<LogUsage entries={[{ function: 'Delay' }]} />));
        expect(container.textContent).toBe('');
    });
});
