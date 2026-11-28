/**
 * @module views/logs/LogUsage
 * The log's usage at a glance: total tokens and cost, one bar split into what was sent
 * (input, cache write, cache read) and what came back (thinking, output), and the steps that
 * used the most.
 */

import { useState } from 'react';
import {
    formatCallCost,
    formatShare,
    formatTokenCount,
    summarizeUsage,
    USAGE_PARTS,
    type UsageEntry,
    type UsagePart
} from '@/domain/story';
import { COST_BILLED, COST_ESTIMATED } from './LogCallFigures';

const PART_LABELS: Record<UsagePart, string> = {
    input: 'Input',
    cacheWrite: 'Cache write',
    cacheRead: 'Cache read',
    thinking: 'Thinking',
    output: 'Output'
};

/** Steps shown before "Show all". */
const STEPS_SHOWN = 5;

export function LogUsage({ entries }: { entries: ReadonlyArray<UsageEntry> }) {
    const [showAll, setShowAll] = useState(false);
    const usage = summarizeUsage(entries);
    if (usage.tokens <= 0) return null;

    const drawn = USAGE_PARTS.filter((part) => usage.parts[part] > 0);
    const describe = (part: UsagePart): string =>
        `${PART_LABELS[part]}: ${usage.parts[part].toLocaleString()} tokens, ${formatShare(usage.parts[part] / usage.tokens)}`;
    const steps = showAll ? usage.steps : usage.steps.slice(0, STEPS_SHOWN);
    const hidden = usage.steps.length - STEPS_SHOWN;
    const anyCost = usage.cost !== null;

    return (
        <section
            className="log-usage bg-surface rounded-2xl border border-edge shadow-sm p-4 sm:p-5 space-y-4"
            data-testid="log-usage"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-ink-900 font-bold text-lg" title={`${usage.tokens.toLocaleString()} tokens`}>
                    {formatTokenCount(usage.tokens)}{' '}
                    <span className="text-sm font-normal text-ink-500">
                        tokens in {usage.calls.toLocaleString()} {usage.calls === 1 ? 'call' : 'calls'}
                    </span>
                </p>
                {usage.cost && (
                    <p
                        className="font-mono font-bold text-gold-ink whitespace-nowrap"
                        title={`${usage.cost.calls} priced ${usage.cost.calls === 1 ? 'call' : 'calls'}. ${usage.cost.exact ? COST_BILLED : COST_ESTIMATED}`}
                        data-testid="log-total-cost"
                    >
                        {formatCallCost(usage.cost)}
                    </p>
                )}
            </div>

            <div
                className="flex h-2 w-full gap-0.5"
                role="img"
                aria-label={drawn.map(describe).join('. ')}
            >
                {drawn.map((part) => (
                    <span
                        key={part}
                        className="h-full rounded-full"
                        title={describe(part)}
                        style={{
                            flexGrow: usage.parts[part],
                            flexBasis: 0,
                            minWidth: 3,
                            background: `var(--usage-${part})`
                        }}
                    />
                ))}
            </div>

            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-500">
                {drawn.map((part) => (
                    <li key={part} className="flex items-center gap-1.5 whitespace-nowrap" title={describe(part)}>
                        <span
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ background: `var(--usage-${part})` }}
                            aria-hidden="true"
                        />
                        {PART_LABELS[part]}
                        <span className="font-mono font-bold text-ink-800" data-testid={`log-usage-${part}`}>
                            {formatTokenCount(usage.parts[part])}
                        </span>
                    </li>
                ))}
            </ul>

            <table className="w-full text-sm">
                <thead>
                    <tr className="text-xs text-ink-500 border-b border-edge">
                        <th className="text-left font-normal py-1.5 pr-3">Step</th>
                        <th className="text-right font-normal py-1.5 px-3 hidden sm:table-cell">Calls</th>
                        <th className="text-right font-normal py-1.5 px-3">Tokens</th>
                        {anyCost && <th className="text-right font-normal py-1.5 px-3">Cost</th>}
                        <th className="text-right font-normal py-1.5 pl-3">Share</th>
                    </tr>
                </thead>
                <tbody>
                    {steps.map((step) => (
                        <tr key={step.name} className="border-b border-edge last:border-b-0">
                            <td className="py-2 pr-3 text-ink-800 font-medium break-words">{step.name}</td>
                            <td className="py-2 px-3 text-right font-mono text-ink-500 hidden sm:table-cell">
                                {step.calls.toLocaleString()}
                            </td>
                            <td
                                className="py-2 px-3 text-right font-mono font-bold text-ink-900 whitespace-nowrap"
                                title={`${step.tokens.toLocaleString()} tokens`}
                            >
                                {formatTokenCount(step.tokens)}
                            </td>
                            {anyCost && (
                                <td className="py-2 px-3 text-right font-mono text-ink-700 whitespace-nowrap">
                                    {step.cost ? formatCallCost(step.cost) : ''}
                                </td>
                            )}
                            <td className="py-2 pl-3 text-right font-mono text-ink-700">
                                {formatShare(step.share)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {hidden > 0 && (
                <button
                    type="button"
                    onClick={() => setShowAll((open) => !open)}
                    className="text-xs font-bold text-ink-500 hover:text-ink-900"
                    aria-expanded={showAll}
                >
                    {showAll ? 'Show fewer' : `Show all ${usage.steps.length} steps`}
                </button>
            )}
        </section>
    );
}
