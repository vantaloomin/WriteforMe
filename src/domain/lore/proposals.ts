/**
 * @module domain/lore/proposals
 * Review mode for lore the model adds by itself. With review on, a new lore item the model
 * extracts from a scene or a plan does not go into the story's lore. It waits on the story as a
 * proposal (`pending_lore`) until the author approves or dismisses it.
 */

export interface LoreProposal {
    id: string;
    topic: string;
    detail: string;
    /** Where in the story the fact was established. */
    act: number;
    scene: number;
    /** When it was proposed, in milliseconds. */
    at: number;
}

export interface LoreProposalStory {
    lore?: Array<{ topic?: unknown; detail?: unknown } | null> | null;
    pending_lore?: unknown;
    [key: string]: unknown;
}

/** Older proposals are dropped past this, so an unattended run cannot grow the story without end. */
export const MOST_LORE_PROPOSALS = 200;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const same = (value: unknown): string => text(value).toLowerCase().replace(/\s+/g, ' ');
const whole = (value: unknown, fallback: number): number => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** The proposals waiting on a story, cleaned. */
export function loreProposals(story: LoreProposalStory | null | undefined): LoreProposal[] {
    const raw = story?.pending_lore;
    if (!Array.isArray(raw)) return [];
    const found: LoreProposal[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const topic = text(rec.topic);
        const detail = text(rec.detail);
        const id = text(rec.id);
        if (!topic || !detail || !id) continue;
        found.push({ id, topic, detail, act: whole(rec.act, 1), scene: whole(rec.scene, 1), at: whole(rec.at, 0) });
    }
    return found;
}

export interface QueuedLore<TStory> {
    story: TStory;
    /** How many of the updates became new proposals. */
    added: number;
}

/**
 * Adds the model's lore updates to the story's proposals. An update that repeats a waiting
 * proposal, or a lore item the story already has, word for word, is left out.
 */
export function queueLoreProposals<TStory extends LoreProposalStory>(
    story: TStory,
    updates: ReadonlyArray<{ topic?: unknown; detail?: unknown } | null | undefined>,
    where: { act?: unknown; scene?: unknown } = {},
    now: number = Date.now()
): QueuedLore<TStory> {
    const waiting = loreProposals(story);
    const known = new Set<string>();
    waiting.forEach((p) => known.add(`${same(p.topic)}|${same(p.detail)}`));
    (story.lore || []).forEach((item) => {
        if (item) known.add(`${same(item.topic)}|${same(item.detail)}`);
    });
    const fresh: LoreProposal[] = [];
    updates.forEach((update, index) => {
        const topic = text(update?.topic);
        const detail = text(update?.detail);
        const key = `${same(topic)}|${same(detail)}`;
        if (!topic || !detail || known.has(key)) return;
        known.add(key);
        fresh.push({
            id: `lp_${now.toString(36)}_${waiting.length + index}`,
            topic,
            detail,
            act: whole(where.act, 1),
            scene: whole(where.scene, 1),
            at: now
        });
    });
    if (fresh.length === 0) return { story, added: 0 };
    return { story: { ...story, pending_lore: [...waiting, ...fresh].slice(-MOST_LORE_PROPOSALS) }, added: fresh.length };
}

/** The story without the named proposals (all of them when no ids are given). */
export function withoutLoreProposals<TStory extends LoreProposalStory>(story: TStory, ids?: ReadonlyArray<string>): TStory {
    const left = ids ? loreProposals(story).filter((p) => !ids.includes(p.id)) : [];
    const next = { ...story };
    if (left.length > 0) next.pending_lore = left;
    else delete next.pending_lore;
    return next;
}

/** A proposal as the lore item it becomes once approved. */
export function loreItemFromProposal(proposal: LoreProposal): {
    topic: string;
    detail: string;
    valid_from_act: number;
    valid_from_scene: number;
} {
    return {
        topic: proposal.topic,
        detail: proposal.detail,
        valid_from_act: proposal.act,
        valid_from_scene: proposal.scene
    };
}
