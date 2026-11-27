import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    MOST_LORE_PROPOSALS,
    loreItemFromProposal,
    loreProposals,
    queueLoreProposals,
    withoutLoreProposals
} from '@/domain/lore';
import type { PipelineRuntimeContext } from '@/pipeline/context';
import { handleWorldUpdates } from '@/pipeline/lorePipeline';
import { normalizeFeatureOptions, useFeatureOptionsStore } from '@/stores';
import { LoreProposalsPanel } from '@/views/lore/LoreProposalsPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type TestStory = { id?: string; lore?: Array<{ topic?: string; detail?: string }>; pending_lore?: unknown; [key: string]: unknown };

const updates = [
    { topic: 'Custom: The Ninth-Year Flood', detail: 'The Marrow floods every ninth year.' },
    { topic: 'Law: Ferry Tolls', detail: 'The toll is one copper.' }
];

describe('lore proposals', () => {
    it('queues new facts with where they were established', () => {
        const { story, added } = queueLoreProposals({ lore: [] } as TestStory, updates, { act: 2, scene: 5 }, 1000);
        expect(added).toBe(2);
        const waiting = loreProposals(story);
        expect(waiting.map((p) => p.topic)).toEqual(['Custom: The Ninth-Year Flood', 'Law: Ferry Tolls']);
        expect(waiting[0]).toMatchObject({ act: 2, scene: 5, at: 1000 });
        expect(new Set(waiting.map((p) => p.id)).size).toBe(2);
    });

    it('leaves out what is already waiting or already lore, and what is empty', () => {
        const first = queueLoreProposals({ lore: [{ topic: 'Law: Ferry Tolls', detail: 'the toll is  one copper.' }] } as TestStory, updates);
        expect(first.added).toBe(1);
        const again = queueLoreProposals(first.story, [...updates, { topic: '', detail: 'x' }, null, { topic: 'T' }]);
        expect(again.added).toBe(0);
        expect(again.story).toBe(first.story);
    });

    it('keeps only the newest when the queue is full', () => {
        const many = Array.from({ length: MOST_LORE_PROPOSALS + 5 }, (_, i) => ({ topic: `T${i}`, detail: `D${i}` }));
        const { story } = queueLoreProposals({} as TestStory, many);
        const waiting = loreProposals(story);
        expect(waiting).toHaveLength(MOST_LORE_PROPOSALS);
        expect(waiting[0].topic).toBe('T5');
    });

    it('removes some or all, and reads a damaged queue as empty', () => {
        const { story } = queueLoreProposals({} as TestStory, updates, {}, 5);
        const [one, two] = loreProposals(story);
        expect(loreProposals(withoutLoreProposals(story, [one.id])).map((p) => p.id)).toEqual([two.id]);
        expect('pending_lore' in withoutLoreProposals(story, [one.id, two.id])).toBe(false);
        expect('pending_lore' in withoutLoreProposals(story)).toBe(false);
        expect(loreProposals({ pending_lore: 'x' })).toEqual([]);
        expect(loreProposals({ pending_lore: [null, { topic: 'T' }, { id: 'a', topic: 'T', detail: 'D' }] })).toHaveLength(1);
        expect(loreItemFromProposal(one)).toEqual({
            topic: 'Custom: The Ninth-Year Flood',
            detail: 'The Marrow floods every ninth year.',
            valid_from_act: 1,
            valid_from_scene: 1
        });
    });
});

describe('the pipeline', () => {
    const setReview = (on: boolean): void => useFeatureOptionsStore.getState().setOption('reviewNewLore', on);
    beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => {
        setReview(false);
        vi.restoreAllMocks();
    });

    function context(initial: TestStory) {
        const box = { story: initial };
        const toasts: string[] = [];
        const ctx = {
            getStory: () => box.story,
            setStory: (updater: unknown) => {
                box.story = typeof updater === 'function' ? (updater as (prev: TestStory) => TestStory)(box.story) : (updater as TestStory);
            },
            setRagStatus: vi.fn(),
            showToast: (message: string) => toasts.push(message),
            callAI: vi.fn(),
            bumpRagIndexRevision: vi.fn(),
            getVectorStore: () => null,
            getEmbeddingService: () => null
        } as unknown as PipelineRuntimeContext;
        return { ctx, box, toasts };
    }

    it('is off by default, and then lore goes straight in', async () => {
        expect(normalizeFeatureOptions({}).reviewNewLore).toBe(false);
        const { ctx, box } = context({ id: 's1', lore: [] });
        await handleWorldUpdates(ctx, { lore_updates: updates }, 1, 1);
        expect((box.story.lore || []).map((l) => l.topic)).toEqual(updates.map((u) => u.topic));
        expect(loreProposals(box.story)).toEqual([]);
    });

    it('holds new lore for review when on, on the live story', async () => {
        setReview(true);
        const { ctx, box, toasts } = context({ id: 's1', lore: [] });
        await handleWorldUpdates(ctx, { lore_updates: updates }, 2, 3);
        expect(box.story.lore || []).toEqual([]);
        expect(loreProposals(box.story).map((p) => [p.topic, p.act, p.scene])).toEqual([
            ['Custom: The Ninth-Year Flood', 2, 3],
            ['Law: Ferry Tolls', 2, 3]
        ]);
        expect(toasts).toEqual(['2 new lore items are waiting for your review on the Lore page.']);
        expect(ctx.bumpRagIndexRevision).not.toHaveBeenCalled();
    });

    it('holds new lore for review when on, on a story being built', async () => {
        setReview(true);
        const { ctx } = context({ id: 's1', lore: [] });
        const result = (await handleWorldUpdates(ctx, { lore_updates: [updates[0]] }, 1, 1, { id: 's1', lore: [] } as never)) as TestStory;
        expect(result.lore || []).toEqual([]);
        expect(loreProposals(result)).toHaveLength(1);
    });
});

describe('the review panel', () => {
    const roots: Root[] = [];
    afterEach(() => {
        while (roots.length) {
            const root = roots.pop();
            act(() => root?.unmount());
        }
        document.body.innerHTML = '';
    });

    it('shows nothing when nothing waits, approves into lore, and dismisses', async () => {
        const box: { story: TestStory } = { story: { lore: [{ topic: 'Old', detail: 'Fact.' }] } };
        const ingested: unknown[] = [];
        const toasts: string[] = [];
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        roots.push(root);
        const render = (): void =>
            act(() =>
                root.render(
                    <LoreProposalsPanel
                        story={box.story}
                        setStory={(updater) => {
                            box.story = updater(box.story);
                            render();
                        }}
                        ingestLore={async (item: { topic?: unknown; detail?: unknown }) => {
                            ingested.push(item);
                            return { ...item, indexed: true };
                        }}
                        showToast={(message) => toasts.push(message)}
                    />
                )
            );
        render();
        expect(host.querySelector('[data-testid="lore-proposals"]')).toBeNull();

        box.story = queueLoreProposals(box.story, [...updates, { topic: 'Rumour', detail: 'Unfounded.' }], { act: 1, scene: 2 }).story;
        render();
        expect(host.textContent).toContain('Proposed by the model (3)');
        expect(host.textContent).toContain('Act 1, Scene 2');

        await act(async () => {
            host.querySelector<HTMLButtonElement>('button[aria-label="Approve Law: Ferry Tolls"]')!.click();
        });
        expect(ingested).toHaveLength(1);
        expect((box.story.lore || []).map((l) => l.topic)).toEqual(['Old', 'Law: Ferry Tolls']);
        expect((box.story.lore || [])[1]).toMatchObject({ indexed: true, valid_from_scene: 2 });
        expect(toasts).toEqual(['Added 1 lore item to the story.']);

        act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Dismiss Rumour"]')!.click());
        expect(loreProposals(box.story).map((p) => p.topic)).toEqual(['Custom: The Ninth-Year Flood']);
        expect(box.story.lore).toHaveLength(2);

        const dismissAll = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Dismiss All')!;
        act(() => dismissAll.click());
        expect('pending_lore' in box.story).toBe(false);
        expect(host.querySelector('[data-testid="lore-proposals"]')).toBeNull();
    });
});
