import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/config';
import {
    costOfCall,
    costOfLogEntry,
    formatCallCost,
    formatUsd,
    formatVerboseLogEntry,
    isModelVersionOf,
    listPriceFor,
    sumLogCosts
} from '@/domain/story';
import { costLogFields, estimateCallCost } from '@/services/llm';

const NOV_2026 = Date.parse('2026-11-28');

afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
});

describe('list prices', () => {
    it('finds a model by its id, a dated snapshot or a preview name', () => {
        expect(listPriceFor('anthropic', 'claude-opus-5-5')?.input).toBe(4);
        expect(listPriceFor('anthropic', 'claude-haiku-4-5-20251001')?.output).toBe(5);
        expect(listPriceFor('gemini', 'models/gemini-3.1-pro-preview')?.input).toBe(2);
    });

    it('never prices a model as its sibling', () => {
        expect(isModelVersionOf('claude-opus-5-5', 'claude-opus-5')).toBe(false);
        expect(isModelVersionOf('gemini-2.5-flash-lite', 'gemini-2.5-flash')).toBe(false);
        expect(listPriceFor('gemini', 'gemini-3.8-flash-lite')).toBeNull();
        expect(listPriceFor('anthropic', 'claude-something-new')).toBeNull();
        expect(listPriceFor('koboldcpp', 'claude-opus-5-5')).toBeNull();
    });

    it('fills cache rates from the provider when a row gives none', () => {
        const opus5 = listPriceFor('anthropic', 'claude-opus-5');
        expect(opus5?.cacheRead).toBeCloseTo(0.5);
        expect(opus5?.cacheWrite).toBeCloseTo(6.25);
        expect(listPriceFor('anthropic', 'claude-opus-5-5')?.cacheRead).toBe(0.2);
    });

    it('uses the long-prompt rate past the threshold and a dated change once it starts', () => {
        expect(listPriceFor('anthropic', 'claude-haiku-5-5', 50_000)?.input).toBe(0.1);
        expect(listPriceFor('anthropic', 'claude-haiku-5-5', 150_000)?.input).toBe(0.5);
        expect(listPriceFor('gemini', 'gemini-3.8-flash', 0, NOV_2026)?.input).toBe(0.75);
        expect(listPriceFor('gemini', 'gemini-3.8-flash', 0, Date.parse('2027-02-01'))?.input).toBe(1.5);
    });
});

describe('costOfCall', () => {
    const opus = listPriceFor('anthropic', 'claude-opus-5-5')!;

    it('bills cached input at its own rates and does not bill thinking twice', () => {
        // 10,000 sent: 6,000 read from cache, 1,000 written, 3,000 plain. 2,000 out.
        const usd = costOfCall(opus, {
            promptTokens: 10_000,
            cachedTokens: 6_000,
            cacheWriteTokens: 1_000,
            responseTokens: 2_000,
            thinkingTokens: 500
        });
        expect(usd).toBeCloseTo((3_000 * 4 + 6_000 * 0.2 + 1_000 * 5 + 2_000 * 20) / 1e6, 10);
    });

    it('adds thinking for a provider that counts it apart', () => {
        const flash = listPriceFor('gemini', 'gemini-2.5-flash')!;
        const usd = costOfCall(flash, { promptTokens: 1_000, responseTokens: 100, thinkingTokens: 400 });
        expect(usd).toBeCloseTo((1_000 * 0.3 + 500 * 2.5) / 1e6, 10);
    });

    it('gives null when nothing was used', () => {
        expect(costOfCall(opus, {})).toBeNull();
    });
});

describe('estimateCallCost', () => {
    const usage = { promptTokens: 9_128, cachedTokens: 920, responseTokens: 2_153, thinkingTokens: 44 };

    it('estimates Anthropic and Gemini from the built-in list', () => {
        const cost = estimateCallCost({ provider: 'anthropic', model: 'claude-opus-5-5', ...usage });
        expect(cost?.exact).toBe(false);
        expect(cost?.usd).toBeCloseTo((8_208 * 4 + 920 * 0.2 + 2_153 * 20) / 1e6, 10);
        expect(estimateCallCost({ provider: 'gemini', model: 'gemini-3.8-flash', ...usage }, NOV_2026)).not.toBeNull();
    });

    it('shows nothing for local providers, even with a model the list knows', () => {
        for (const provider of ['koboldcpp', 'claude', 'codex']) {
            expect(estimateCallCost({ provider, model: 'claude-opus-5-5', ...usage })).toBeNull();
        }
    });

    it('shows nothing for a model nobody has a price for', () => {
        expect(estimateCallCost({ provider: 'anthropic', model: 'claude-next', ...usage })).toBeNull();
        expect(estimateCallCost({ provider: 'openrouter', model: 'vendor/unknown', ...usage })).toBeNull();
        expect(estimateCallCost({ provider: 'nanogpt', model: 'gpt-4o', ...usage })).toBeNull();
    });

    it('takes the charge OpenRouter reports as exact, and a zero charge as free', () => {
        const call = { provider: 'openrouter', model: 'vendor/model', ...usage };
        expect(estimateCallCost({ ...call, reportedCost: 0.0123 })).toEqual({ usd: 0.0123, exact: true });
        expect(estimateCallCost({ ...call, reportedCost: 0 })).toBeNull();
    });

    it('falls back to the OpenRouter catalog, priced per token', () => {
        sessionStorage.setItem(
            STORAGE_KEYS.openRouterModelsCache,
            JSON.stringify([
                { id: 'vendor/model-mini', pricing: { prompt: '0.0000001', completion: '0.0000004' } },
                {
                    id: 'vendor/model',
                    pricing: { prompt: '0.000003', completion: '0.000015', input_cache_read: '0.0000003' }
                },
                { id: 'vendor/model:free', pricing: { prompt: '0', completion: '0' } }
            ])
        );
        const cost = estimateCallCost({ provider: 'openrouter', model: 'vendor/model', ...usage });
        expect(cost?.exact).toBe(false);
        expect(cost?.usd).toBeCloseTo((8_208 * 3 + 920 * 0.3 + 2_153 * 15) / 1e6, 10);
        expect(estimateCallCost({ provider: 'openrouter', model: 'vendor/model:free', ...usage })).toBeNull();
    });

    it('reads the nano-GPT catalog, priced per million with cache rates per thousand', () => {
        localStorage.setItem(
            STORAGE_KEYS.nanoGptModelsCache,
            JSON.stringify([
                'plain-string-entry',
                { id: 'gpt-x', pricing: { prompt: 2, completion: 10, cacheReadInputPer1kTokens: 0.0001 } },
                { id: 'summary-only', pricing: { summary: 'cheap' } }
            ])
        );
        const cost = estimateCallCost({ provider: 'nanogpt', model: 'gpt-x', ...usage });
        expect(cost?.usd).toBeCloseTo((8_208 * 2 + 920 * 0.1 + 2_153 * 10) / 1e6, 10);
        expect(estimateCallCost({ provider: 'nanogpt', model: 'summary-only', ...usage })).toBeNull();
    });

    it('survives a broken catalog cache', () => {
        sessionStorage.setItem(STORAGE_KEYS.openRouterModelsCache, '{not json');
        expect(estimateCallCost({ provider: 'openrouter', model: 'vendor/model', ...usage })).toBeNull();
    });

    it('gives the log its two fields', () => {
        expect(costLogFields({ provider: 'koboldcpp', model: 'local', ...usage })).toEqual({
            costUsd: null,
            costExact: false
        });
        expect(costLogFields({ provider: 'openrouter', model: 'm', reportedCost: 0.5 })).toEqual({
            costUsd: 0.5,
            costExact: true
        });
    });
});

describe('showing a cost', () => {
    it('keeps small amounts from reading as zero', () => {
        expect(formatUsd(12.345)).toBe('$12.35');
        expect(formatUsd(0.0421)).toBe('$0.042');
        expect(formatUsd(0.00312)).toBe('$0.0031');
        expect(formatUsd(0.00001)).toBe('<$0.0001');
    });

    it('marks an estimate and leaves a billed amount bare', () => {
        expect(formatCallCost({ usd: 0.5, exact: false })).toBe('≈ $0.500');
        expect(formatCallCost({ usd: 0.5, exact: true })).toBe('$0.500');
    });

    it('totals only priced entries and stays approximate if any part is', () => {
        expect(sumLogCosts([{ costUsd: null }, { costUsd: 0 }, {}])).toBeNull();
        expect(costOfLogEntry({ costUsd: 0 })).toBeNull();
        const total = sumLogCosts([
            { costUsd: 0.25, costExact: true },
            { costUsd: 0.5, costExact: false },
            { costUsd: null }
        ]);
        expect(total).toEqual({ usd: 0.75, exact: false, calls: 2 });
        expect(sumLogCosts([{ costUsd: 0.25, costExact: true }])?.exact).toBe(true);
    });

    it('adds the cost to the exported dossier only when there is one', () => {
        const base = { function: 'Step', promptTokens: 10, responseTokens: 5, tokensUsed: 15 };
        expect(formatVerboseLogEntry({ ...base, costUsd: 0.042 })).toContain('Cost (approximate):       $0.042');
        expect(formatVerboseLogEntry({ ...base, costUsd: 0.042, costExact: true })).toContain('Cost (billed):');
        expect(formatVerboseLogEntry(base)).not.toContain('Cost (');
    });
});
