/**
 * @module views/logs/LogCallFigures
 * Figures shown on one call in the log: how much of its prompt was read from or written to the
 * provider's cache, and what the call cost. The totals for the whole log are in `LogUsage`.
 */

import { PRICES_CHECKED_ON } from '@/config';
import { costOfLogEntry, formatCallCost } from '@/domain/story';

interface CountedEntry {
    promptTokens?: number | null;
    cachedTokens?: number | null;
    cacheWriteTokens?: number | null;
    routedProvider?: string | null;
    costUsd?: number | null;
    costExact?: boolean;
}

export const COST_BILLED = 'Charged by the provider for this call';
export const COST_ESTIMATED = `Tokens × list price (prices read ${PRICES_CHECKED_ON}). Your bill may differ.`;

/** What one call cost. Renders nothing for local, free or unpriced models. */
export function LogCost({ entry }: { entry: CountedEntry }) {
    const cost = costOfLogEntry(entry);
    if (!cost) return null;
    return (
        <span
            className="font-mono text-gold-ink font-bold whitespace-nowrap border-l border-edge-strong pl-2 ml-1"
            title={cost.exact ? COST_BILLED : COST_ESTIMATED}
            data-testid="log-entry-cost"
        >
            {formatCallCost(cost)}
        </span>
    );
}

const CACHE_READ = 'Input the provider had already stored and read back, billed at a fraction of the input price';
const CACHE_WRITE = 'Input stored for later calls to read back. Claude bills this above the input price.';

const shareOf = (part: number, whole: number | null | undefined): string =>
    whole && whole > 0 ? ` (${Math.min(100, Math.round((part / whole) * 100))}%)` : '';

/** How much of what one call sent was read from, and written to, the provider's prompt cache. */
export function LogCacheTokens({ entry }: { entry: CountedEntry }) {
    const read = entry.cachedTokens || 0;
    const written = entry.cacheWriteTokens || 0;
    if (read <= 0 && written <= 0) return null;
    return (
        <>
            {read > 0 && (
                <div
                    className="flex items-center gap-1 text-sage-800 font-bold bg-sage-tint px-2 py-0.5 rounded-md border border-sage-edge whitespace-nowrap"
                    title={CACHE_READ}
                    data-testid="log-entry-cache-read"
                >
                    Cache read:{' '}
                    <span className="font-mono">
                        {read.toLocaleString()}
                        {shareOf(read, entry.promptTokens)}
                    </span>
                </div>
            )}
            {written > 0 && (
                <div
                    className="flex items-center gap-1 text-ink-700 font-bold bg-inset px-2 py-0.5 rounded-md border border-edge-strong whitespace-nowrap"
                    title={CACHE_WRITE}
                    data-testid="log-entry-cache-write"
                >
                    Cache write:{' '}
                    <span className="font-mono">
                        {written.toLocaleString()}
                        {shareOf(written, entry.promptTokens)}
                    </span>
                </div>
            )}
            {entry.routedProvider && (
                <span className="text-ink-500">via {entry.routedProvider}</span>
            )}
        </>
    );
}
