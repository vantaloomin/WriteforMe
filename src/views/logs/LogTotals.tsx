/**
 * @module views/logs/LogTotals
 * The running totals beside the log's title (tokens sent, thought, answered, and what the
 * calls cost) and the cost shown on one call.
 */

import { ArrowUpRight, Brain, MessageSquare } from '@/components/icons';
import { PRICES_CHECKED_ON } from '@/config';
import { costOfLogEntry, formatCallCost, sumLogCosts } from '@/domain/story';

interface CountedEntry {
    promptTokens?: number | null;
    thinkingTokens?: number | null;
    reasoningTokensUsed?: number | null;
    responseTokens?: number | null;
    costUsd?: number | null;
    costExact?: boolean;
}

const BILLED = 'Charged by the provider for this call';
const ESTIMATED = `Tokens × list price (prices read ${PRICES_CHECKED_ON}). Your bill may differ.`;

/** What one call cost. Renders nothing for local, free or unpriced models. */
export function LogCost({ entry }: { entry: CountedEntry }) {
    const cost = costOfLogEntry(entry);
    if (!cost) return null;
    return (
        <span
            className="font-mono text-gold-ink font-bold whitespace-nowrap border-l border-edge-strong pl-2 ml-1"
            title={cost.exact ? BILLED : ESTIMATED}
            data-testid="log-entry-cost"
        >
            {formatCallCost(cost)}
        </span>
    );
}

export function LogTotals({ entries }: { entries: ReadonlyArray<CountedEntry> }) {
    const sent = entries.reduce((acc, e) => acc + (e.promptTokens || 0), 0);
    const thinking = entries.reduce(
        (acc, e) => acc + (e.thinkingTokens || e.reasoningTokensUsed || 0),
        0
    );
    const response = entries.reduce((acc, e) => acc + (e.responseTokens || 0), 0);
    const all = sent + thinking + response;
    const cost = sumLogCosts(entries);

    return (
        <>
            {sent > 0 && (
                <span
                    className="text-xs font-mono font-bold text-sage-800 bg-sage-tint px-2.5 py-1 rounded-full border border-sage-edge flex items-center gap-1"
                    title="Total tokens sent to AI across all steps"
                >
                    <ArrowUpRight size={11} className="text-sage-600" /> Sent:{' '}
                    {sent.toLocaleString()} tok
                </span>
            )}
            {thinking > 0 && (
                <span
                    className="text-xs font-mono font-bold text-plum-800 bg-plum-tint px-2.5 py-1 rounded-full border border-plum-edge flex items-center gap-1"
                    title="Total thinking / reasoning tokens generated"
                >
                    <Brain size={11} className="text-plum-600" /> Think: {thinking.toLocaleString()}{' '}
                    tok
                </span>
            )}
            {response > 0 && (
                <span
                    className="text-xs font-mono font-bold text-blue-800 bg-azure-tint px-2.5 py-1 rounded-full border border-azure-edge flex items-center gap-1"
                    title="Total response tokens generated"
                >
                    <MessageSquare size={11} className="text-blue-600" /> Resp:{' '}
                    {response.toLocaleString()} tok
                </span>
            )}
            {all > 0 && (
                <span
                    className="text-xs font-mono font-bold text-ink-700 bg-inset px-2.5 py-1 rounded-full border border-edge-strong flex items-center gap-1"
                    title="Total context & generation tokens (Sent + Think + Resp)"
                >
                    Total: {all.toLocaleString()} tok
                </span>
            )}
            {cost && (
                <span
                    className="text-xs font-mono font-bold text-gold-ink bg-inset px-2.5 py-1 rounded-full border border-edge-strong whitespace-nowrap"
                    title={`${cost.calls} priced ${cost.calls === 1 ? 'call' : 'calls'}. ${cost.exact ? 'Charged by the provider.' : ESTIMATED}`}
                    data-testid="log-total-cost"
                >
                    {formatCallCost(cost)}
                </span>
            )}
        </>
    );
}
