/**
 * @module views/lore/LoreProposalsPanel
 * The lore the model wants to add, waiting for the author: approve an item to make it canon (it
 * is indexed like any other lore), or dismiss it. Shown on the Lore page only while something is
 * waiting.
 */

import React, { useState } from 'react';
import { loreItemFromProposal, loreProposals, withoutLoreProposals, type LoreProposal, type LoreProposalStory } from '@/domain/lore';

export interface LoreProposalsPanelProps<TStory extends LoreProposalStory, TItem extends { topic?: unknown; detail?: unknown }> {
    story: TStory;
    setStory: (updater: (prev: TStory) => TStory) => unknown;
    /** Indexes one lore item and returns it as stored (or nothing, when it could not be indexed). */
    ingestLore: (item: TItem) => Promise<TItem | null | undefined>;
    showToast: (msg: string, type?: string) => void;
}

const button = 'text-xs px-2.5 py-1 rounded-lg border border-edge-strong text-ink-700 hover:bg-wash cursor-pointer disabled:opacity-50';

export function LoreProposalsPanel<TStory extends LoreProposalStory, TItem extends { topic?: unknown; detail?: unknown }>({
    story,
    setStory,
    ingestLore,
    showToast
}: LoreProposalsPanelProps<TStory, TItem>) {
    const [busy, setBusy] = useState(false);
    const waiting = loreProposals(story);
    if (waiting.length === 0) return null;

    const approve = async (proposals: LoreProposal[]): Promise<void> => {
        setBusy(true);
        let added = 0;
        try {
            for (const proposal of proposals) {
                const item = loreItemFromProposal(proposal) as unknown as TItem;
                const processed = await ingestLore(item);
                setStory((prev) => ({
                    ...withoutLoreProposals(prev, [proposal.id]),
                    lore: [...((prev.lore as unknown[]) || []), processed || item]
                }));
                added += 1;
            }
            showToast(`Added ${added} lore item${added === 1 ? '' : 's'} to the story.`, 'success');
        } catch (err) {
            showToast(
                `Added ${added} of ${proposals.length}; the rest are still waiting. ${err instanceof Error ? err.message : String(err)}`,
                'error'
            );
        } finally {
            setBusy(false);
        }
    };

    const dismiss = (ids?: string[]): void => {
        setStory((prev) => withoutLoreProposals(prev, ids));
    };

    return (
        <div className="bg-surface p-5 rounded-2xl border border-gold-edge shadow-sm space-y-3" data-testid="lore-proposals">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <span className="text-sm font-bold text-ink-900 font-serif">
                        Proposed by the model ({waiting.length})
                    </span>
                    <p className="text-xs text-ink-500">
                        New facts the model picked up while writing. None is part of the story until you approve it.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void approve(waiting)} className={button}>
                        Approve All
                    </button>
                    <button type="button" disabled={busy} onClick={() => dismiss()} className={button}>
                        Dismiss All
                    </button>
                </div>
            </div>
            <ul className="space-y-2">
                {waiting.map((proposal) => (
                    <li key={proposal.id} className="p-3 bg-inset border border-edge-strong rounded-xl space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                            <span className="text-xs font-bold text-ink-900">{proposal.topic}</span>
                            <span className="text-[10px] font-mono text-ink-500 shrink-0">
                                Act {proposal.act}, Scene {proposal.scene}
                            </span>
                        </div>
                        <p className="text-xs text-ink-700 whitespace-pre-wrap">{proposal.detail}</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void approve([proposal])}
                                className={`${button} font-bold`}
                                aria-label={`Approve ${proposal.topic}`}
                            >
                                Approve
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => dismiss([proposal.id])}
                                className={button}
                                aria-label={`Dismiss ${proposal.topic}`}
                            >
                                Dismiss
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
