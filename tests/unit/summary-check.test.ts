import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    checkedSummary,
    numbersIn,
    quotesIn,
    summaryDropped,
    summaryHolds,
    summaryMustKeep,
    summaryRetryNote,
    summaryWithKept,
    SUMMARY_KEEP_LIMIT
} from '@/domain/story';
import { updateStorySoFar, type CallAiFn, type PipelineRuntimeContext, type PipelineStory } from '@/pipeline';
import { DEFAULT_SLOP_CONFIG } from '@/domain/slop';
import { DEFAULT_FEATURE_OPTIONS, useFeatureOptionsStore } from '@/stores';

const BEFORE =
    'Mara Quillon owes the harbor office 400 crowns. At 9:30 she told Tom, "I will pay by the feast of lamps." Ilse watched from pier 7.';

describe('summary check: what must be kept', () => {
    it('reads numbers the way a story writes them', () => {
        expect(numbersIn('400 crowns at 9:30, then 1,200 and 3.5 more.')).toEqual(['400', '9:30', '1,200', '3.5']);
    });

    it('keeps every quote of the earlier summary but only pledges from new text', () => {
        expect(quotesIn('"Pass the salt." "I swear I will come back."')).toEqual(['I swear I will come back.']);
        expect(quotesIn('"Pass the salt."', false)).toEqual(['Pass the salt.']);
    });

    it('lists the quotes, known names and numbers of the summary before', () => {
        const items = summaryMustKeep({
            before: BEFORE,
            folded: 'Tom said, "You owe me for the boat." Then: "Nice weather."',
            knownNames: ['Mara Quillon', 'Tom Reyes', 'Ilse Brandt', 'Dov Katz']
        });
        expect(items.filter((i) => i.kind === 'quote').map((i) => i.text)).toEqual([
            'I will pay by the feast of lamps.',
            'You owe me for the boat.'
        ]);
        expect(items.filter((i) => i.kind === 'name').map((i) => i.text)).toEqual(['Mara Quillon', 'Tom', 'Ilse']);
        expect(items.filter((i) => i.kind === 'number').map((i) => i.text)).toEqual(['400', '9:30', '7']);
    });

    it('never asks for more than the limit', () => {
        const before = Array.from({ length: 80 }, (_, i) => `Item ${i + 100}.`).join(' ');
        expect(summaryMustKeep({ before })).toHaveLength(SUMMARY_KEEP_LIMIT);
    });
});

describe('summary check: what a draft holds', () => {
    it('accepts a first name for a full name, a small number as a word, and curly quotes', () => {
        expect(summaryHolds({ kind: 'name', text: 'Mara Quillon', alternatives: ['Mara', 'Quillon'] }, 'Mara paid.')).toBe(true);
        expect(summaryHolds({ kind: 'name', text: 'Tom' }, 'The Tomb was shut.')).toBe(false);
        expect(summaryHolds({ kind: 'number', text: '7' }, 'from pier seven')).toBe(true);
        expect(summaryHolds({ kind: 'number', text: '400' }, 'she owed 1400 crowns')).toBe(false);
        expect(summaryHolds({ kind: 'quote', text: 'I will pay by the feast of lamps.' }, 'She said, “I will pay by the feast of lamps,” and left.')).toBe(true);
    });

    it('names what a draft dropped and adds it back word for word', () => {
        const items = summaryMustKeep({ before: BEFORE, knownNames: ['Mara Quillon', 'Tom Reyes', 'Ilse Brandt'] });
        const draft = 'Mara is in debt to the harbor office and has promised Tom she will pay.';
        const missing = summaryDropped(items, draft);
        expect(missing.map((i) => i.text)).toEqual(['I will pay by the feast of lamps.', 'Ilse', '400', '9:30', '7']);
        expect(summaryRetryNote(missing)).toContain('- "I will pay by the feast of lamps."');
        expect(summaryWithKept(draft, missing)).toBe(`${draft}\n\nAlso kept: "I will pay by the feast of lamps."; Ilse; 400; 9:30; 7.`);
        expect(summaryWithKept(draft, [])).toBe(draft);
    });
});

describe('summary check: asking again', () => {
    const items = summaryMustKeep({ before: BEFORE, knownNames: ['Mara Quillon', 'Tom Reyes', 'Ilse Brandt'] });

    it('asks once when the draft keeps everything', async () => {
        const draft = vi.fn(async () => BEFORE);
        const result = await checkedSummary(draft, items);
        expect(draft).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ text: BEFORE, missing: [], retried: false });
    });

    it('asks again with what was dropped and keeps the better draft', async () => {
        const draft = vi.fn(async (note: string) => (note ? `${BEFORE} More happened.` : 'Mara owes money.'));
        const result = await checkedSummary(draft, items);
        expect(draft).toHaveBeenCalledTimes(2);
        expect(draft.mock.calls[1][0]).toContain('- 400');
        expect(result.text).toBe(`${BEFORE} More happened.`);
        expect(result.missing).toEqual([]);
    });

    it('adds back what the second draft still drops', async () => {
        const draft = vi.fn(async (note: string) =>
            note ? 'Mara owes 400 crowns. Tom and Ilse know.' : 'Mara owes money.'
        );
        const result = await checkedSummary(draft, items);
        expect(result.text).toBe('Mara owes 400 crowns. Tom and Ilse know.\n\nAlso kept: "I will pay by the feast of lamps."; 9:30; 7.');
    });

    it('keeps the first draft when the second ask fails or is worse', async () => {
        const failing = vi.fn(async (note: string) => {
            if (note) throw new Error('model down');
            return 'Mara owes 400 crowns to Tom.';
        });
        expect((await checkedSummary(failing, items)).text.startsWith('Mara owes 400 crowns to Tom.\n\nAlso kept:')).toBe(true);
        const worse = vi.fn(async (note: string) => (note ? 'Nothing.' : 'Mara owes 400 crowns to Tom.'));
        expect((await checkedSummary(worse, items)).text.startsWith('Mara owes 400 crowns to Tom.')).toBe(true);
    });
});

describe('updateStorySoFar with the check', () => {
    afterEach(() => useFeatureOptionsStore.setState({ options: { ...DEFAULT_FEATURE_OPTIONS } }));

    const story: PipelineStory = {
        id: 'story_sum',
        concept: 'A debt comes due.',
        cast: [{ id: 'C1', name: 'Mara Quillon' }, { id: 'C2', name: 'Tom Reyes' }, { id: 'C3', name: 'Ilse Brandt' }],
        acts: [],
        sequences: [{ number: 1, title: 'Arrivals' }],
        scenes: { '0': [{ number: '1.1', title: 'Dock', scene_objective: 'Meet Tom' }] },
        prose: { '0-0': { final: 'The gulls wheeled over the cranes while Tom counted crates.' } },
        story_so_far: BEFORE
    };

    function makeCtx(callAI: CallAiFn) {
        const logs: Array<{ stage: string; passed: boolean; details: string | string[] }> = [];
        const ctx = {
            getStory: () => story,
            setStory: () => {},
            callAI,
            setLoadingStep: () => {},
            setLoading: () => {},
            showToast: () => {},
            getSlopConfig: () => DEFAULT_SLOP_CONFIG,
            getEnableReview: () => false,
            getEnableNarrativeLenses: () => false,
            getBannedPhrases: () => [],
            getFeedbackLedger: () => ({}),
            setFeedbackLedger: () => {},
            logPipelineValidation: (stage: string, passed: boolean, details: string | string[]) => logs.push({ stage, passed, details }),
            logPipelineError: () => {}
        } as unknown as PipelineRuntimeContext;
        return { ctx, logs };
    }

    const wrap = (text: string) => `<response><story_so_far>${text}</story_so_far></response>`;

    it('retries a draft that dropped a number and a quote, and uses the complete one', async () => {
        const good = `${BEFORE} Tom counted crates at dawn.`;
        const callAI = vi.fn<CallAiFn>(async (prompt) =>
            wrap(String(prompt).includes('<dropped_from_last_draft>') ? good : 'Mara owes the harbor office money, and Tom and Ilse know it.')
        );
        const { ctx, logs } = makeCtx(callAI);
        const out = await updateStorySoFar(ctx, story);
        expect(out).toBe(good);
        expect(callAI).toHaveBeenCalledTimes(2);
        expect(String(callAI.mock.calls[1][0])).toContain('- "I will pay by the feast of lamps."');
        expect(logs.find((l) => l.stage === 'Story So Far: summary check')?.passed).toBe(true);
    });

    it('adds back what both drafts dropped', async () => {
        const callAI = vi.fn<CallAiFn>(async () => wrap('Mara owes the harbor office money, and Tom and Ilse know it.'));
        const { ctx, logs } = makeCtx(callAI);
        const out = await updateStorySoFar(ctx, story);
        expect(out).toContain('Also kept: "I will pay by the feast of lamps."; 400; 9:30; 7.');
        expect(logs.find((l) => l.stage === 'Story So Far: summary check')?.passed).toBe(false);
    });

    it('makes one call when the draft keeps everything, or when the check is off', async () => {
        const complete = vi.fn<CallAiFn>(async () => wrap(`${BEFORE} Tom counted crates.`));
        await updateStorySoFar(makeCtx(complete).ctx, story);
        expect(complete).toHaveBeenCalledTimes(1);

        useFeatureOptionsStore.setState({ options: { ...DEFAULT_FEATURE_OPTIONS, summaryCheck: false } });
        const lossy = vi.fn<CallAiFn>(async () => wrap('Mara owes the harbor office money, and everyone knows it.'));
        const out = await updateStorySoFar(makeCtx(lossy).ctx, story);
        expect(lossy).toHaveBeenCalledTimes(1);
        expect(out).not.toContain('Also kept');
    });

    it('does not check the first summary of a story', async () => {
        const callAI = vi.fn<CallAiFn>(async () => wrap('Tom counts crates on the dock at dawn and waits.'));
        const out = await updateStorySoFar(makeCtx(callAI).ctx, { ...story, story_so_far: '' });
        expect(callAI).toHaveBeenCalledTimes(1);
        expect(out).toBe('Tom counts crates on the dock at dawn and waits.');
    });
});
