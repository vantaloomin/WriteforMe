/**
 * @module views/logs/LogUsage
 * The log's usage at a glance: total tokens and cost, one bar split into what was sent
 * (input, cache write, cache read) and what came back (thinking, output), the models that ran,
 * and the steps that used the most. Closed, it is the totals line and the bar; a click on that
 * line opens the rest, and the choice is kept for next time.
 *
 * Every token part, model and step is also a filter: picking some narrows the log below to the
 * calls that match, and dims what was not picked.
 */

import { useState } from 'react';
import { ChevronDown } from '@/components/icons';
import { STORAGE_KEYS } from '@/config';
import {
    filterUsage,
    formatCallCost,
    formatShare,
    formatTokenCount,
    isUsageFilterActive,
    NO_USAGE_FILTER,
    toggleUsageFilter,
    USAGE_PARTS,
    type UsageEntry,
    type UsageFilter,
    type UsageFilterKind,
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

const CHIP = 'flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 transition';
const CHIP_PICKED = 'border-ink-500 bg-inset text-ink-900';
const CHIP_PLAIN = 'border-edge hover:border-edge-strong hover:text-ink-900';
const DIMMED = 'opacity-45 hover:opacity-100';

function readOpen(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEYS.logUsageOpen) === '1';
    } catch {
        return false;
    }
}

function saveOpen(open: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEYS.logUsageOpen, open ? '1' : '0');
    } catch {
        // Storage can be blocked; the panel still opens and closes for this visit.
    }
}

export interface LogUsageProps {
    entries: ReadonlyArray<UsageEntry>;
    filter?: UsageFilter;
    onFilter?: (next: UsageFilter) => void;
}

export function LogUsage({ entries, filter = NO_USAGE_FILTER, onFilter }: LogUsageProps) {
    const [open, setOpen] = useState(readOpen);
    const [showAll, setShowAll] = useState(false);
    const usage = filterUsage(entries, filter);
    if (usage.calls <= 0) return null;

    const { shown } = usage;
    const filtered = isUsageFilterActive(filter);
    const drawn = USAGE_PARTS.filter((part) => shown.parts[part] > 0);
    const listed = USAGE_PARTS.filter((part) => usage.parts[part] > 0);
    const describe = (part: UsagePart, of = shown): string =>
        `${PART_LABELS[part]}: ${of.parts[part].toLocaleString()} tokens, ${formatShare(of.parts[part] / (of.tokens || 1))}`;
    // A picked step stays in view even when it is not among the largest.
    const steps = showAll
        ? usage.steps
        : usage.steps.filter((step, index) => index < STEPS_SHOWN || filter.steps.includes(step.name));
    const hidden = usage.steps.length - steps.length;
    const anyCost = usage.steps.some((step) => step.cost) || shown.cost !== null;
    const toggle = (): void => {
        saveOpen(!open);
        setOpen(!open);
    };
    const pick = (kind: UsageFilterKind, value: string): void => onFilter?.(toggleUsageFilter(filter, kind, value));
    /** Chip and row styling: picked stands out, the rest dims once anything of its kind is picked. */
    const state = (kind: UsageFilterKind, value: string): 'picked' | 'dimmed' | 'plain' =>
        (filter[kind] as string[]).includes(value) ? 'picked' : filter[kind].length > 0 ? 'dimmed' : 'plain';
    const chipClass = (kind: UsageFilterKind, value: string): string => {
        const s = state(kind, value);
        return `${CHIP} ${s === 'picked' ? CHIP_PICKED : CHIP_PLAIN} ${s === 'dimmed' ? DIMMED : ''}`;
    };

    return (
        <section
            className="log-usage bg-surface rounded-2xl border border-edge shadow-sm p-4 sm:p-5 space-y-3"
            data-testid="log-usage"
        >
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-controls="log-usage-details"
                className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-left"
                data-testid="log-usage-toggle"
            >
                <span className="text-ink-900 font-bold text-lg" title={`${shown.tokens.toLocaleString()} tokens`}>
                    {formatTokenCount(shown.tokens)}{' '}
                    <span className="text-sm font-normal text-ink-500" data-testid="log-usage-calls">
                        tokens in {shown.calls.toLocaleString()}
                        {filtered ? ` of ${usage.calls.toLocaleString()}` : ''} {usage.calls === 1 ? 'call' : 'calls'}
                    </span>
                </span>
                <span className="flex items-center gap-2">
                    {shown.cost && (
                        <span
                            className="font-mono font-bold text-gold-ink whitespace-nowrap"
                            title={`${shown.cost.calls} priced ${shown.cost.calls === 1 ? 'call' : 'calls'}. ${shown.cost.exact ? COST_BILLED : COST_ESTIMATED}`}
                            data-testid="log-total-cost"
                        >
                            {formatCallCost(shown.cost)}
                        </span>
                    )}
                    <ChevronDown
                        size={16}
                        className={`self-center text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </span>
            </button>

            <div className="flex h-2 w-full gap-0.5" role="img" aria-label={drawn.map((part) => describe(part)).join('. ')}>
                {drawn.map((part) => (
                    <span
                        key={part}
                        className={`h-full rounded-full transition-opacity ${state('parts', part) === 'dimmed' ? 'opacity-30' : ''}`}
                        title={describe(part)}
                        style={{
                            flexGrow: shown.parts[part],
                            flexBasis: 0,
                            minWidth: 3,
                            background: `var(--usage-${part})`
                        }}
                    />
                ))}
            </div>

            {open && (
                <div id="log-usage-details" className="space-y-4 pt-1">
                    <ul className="flex flex-wrap gap-1.5 text-xs text-ink-500">
                        {listed.map((part) => (
                            <li key={part}>
                                <button
                                    type="button"
                                    className={chipClass('parts', part)}
                                    aria-pressed={filter.parts.includes(part)}
                                    onClick={() => pick('parts', part)}
                                    title={`Show only calls with ${PART_LABELS[part].toLowerCase()} tokens`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-sm"
                                        style={{ background: `var(--usage-${part})` }}
                                        aria-hidden="true"
                                    />
                                    {PART_LABELS[part]}
                                    <span className="font-mono font-bold text-ink-800" data-testid={`log-usage-${part}`}>
                                        {formatTokenCount(usage.parts[part])}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>

                    <ul className="flex flex-wrap gap-1.5 text-xs text-ink-500" data-testid="log-usage-models">
                        {usage.models.map((model) => (
                            <li key={model.name} className="min-w-0">
                                <button
                                    type="button"
                                    className={`${chipClass('models', model.name)} max-w-full`}
                                    aria-pressed={filter.models.includes(model.name)}
                                    onClick={() => pick('models', model.name)}
                                    title={`${model.name}: ${model.tokens.toLocaleString()} tokens in ${model.calls.toLocaleString()} ${model.calls === 1 ? 'call' : 'calls'}`}
                                >
                                    <span className="font-mono text-ink-800 truncate">{model.name}</span>
                                    <span className="font-mono font-bold text-ink-800">{formatTokenCount(model.tokens)}</span>
                                    {model.cost && <span className="font-mono text-gold-ink">{formatCallCost(model.cost)}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-ink-500 border-b border-edge">
                                <th className="text-left font-normal py-1.5 pr-3 pl-2">Step</th>
                                <th className="text-left font-normal py-1.5 px-3 hidden md:table-cell">Model</th>
                                <th className="text-right font-normal py-1.5 px-3 hidden sm:table-cell">Calls</th>
                                <th className="text-right font-normal py-1.5 px-3">Tokens</th>
                                {anyCost && <th className="text-right font-normal py-1.5 px-3">Cost</th>}
                                <th className="text-right font-normal py-1.5 pl-3 pr-2">Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {steps.map((step) => {
                                const s = state('steps', step.name);
                                return (
                                    <tr
                                        key={step.name}
                                        onClick={() => pick('steps', step.name)}
                                        className={`border-b border-edge last:border-b-0 cursor-pointer transition hover:bg-inset ${s === 'picked' ? 'bg-inset' : ''} ${s === 'dimmed' ? DIMMED : ''}`}
                                    >
                                        <td className="py-2 pr-3 pl-2 text-ink-800 font-medium break-words rounded-l-lg">
                                            <button
                                                type="button"
                                                className="text-left"
                                                aria-pressed={s === 'picked'}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    pick('steps', step.name);
                                                }}
                                            >
                                                {step.name}
                                            </button>
                                        </td>
                                        <td
                                            className="py-2 px-3 font-mono text-xs text-ink-500 hidden md:table-cell"
                                            title={step.models.join(', ')}
                                        >
                                            {step.models.length === 1 ? step.models[0] : `${step.models.length} models`}
                                        </td>
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
                                        <td className="py-2 pl-3 pr-2 text-right font-mono text-ink-700 rounded-r-lg">
                                            {formatShare(step.share)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {(hidden > 0 || showAll || filtered) && (
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-ink-500">
                            {(hidden > 0 || showAll) && usage.steps.length > STEPS_SHOWN && (
                                <button
                                    type="button"
                                    onClick={() => setShowAll((all) => !all)}
                                    className="hover:text-ink-900"
                                    aria-expanded={showAll}
                                    data-testid="log-usage-more"
                                >
                                    {showAll ? 'Show fewer' : `Show all ${usage.steps.length} steps`}
                                </button>
                            )}
                            {filtered && (
                                <button
                                    type="button"
                                    onClick={() => onFilter?.(NO_USAGE_FILTER)}
                                    className="hover:text-ink-900"
                                    data-testid="log-usage-clear"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
