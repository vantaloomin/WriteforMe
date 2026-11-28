/**
 * @module views/logs/LogUsage
 * The log's usage at a glance: total tokens and cost, one bar split into what was sent
 * (input, cache write, cache read) and what came back (thinking, output), the models that ran,
 * and the steps that used the most. Closed, it is the totals line and the bar; a click on that
 * line opens the rest, and the choice is kept for next time.
 *
 * Model chips and step rows are also filters: picking some narrows the log below, and the
 * totals line and the bar, to the calls that match. The two lists themselves never change, so
 * a pick cannot hide another pick.
 */

import { useState } from 'react';
import { ChevronDown } from '@/components/icons';
import { STORAGE_KEYS } from '@/config';
import {
    DEFAULT_STEP_SORT,
    filterUsage,
    formatCallCost,
    formatShare,
    formatTokenCount,
    isUsageFilterActive,
    nextStepSort,
    NO_USAGE_FILTER,
    sortSteps,
    toggleUsageFilter,
    USAGE_PARTS,
    type StepSortKey,
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

const CHIP =
    'flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 sm:py-1 font-mono transition';
const CHIP_PICKED = 'border-btn bg-btn text-btn-ink';
const CHIP_PLAIN = 'border-edge text-ink-800 hover:border-edge-strong';
/** Not picked while something else in the list is: quieter, still readable. */
const MUTED = 'opacity-60 hover:opacity-100';
const TEXT_BUTTON = 'text-xs font-bold text-ink-500 hover:text-ink-900';

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

/** "vendor/model-id" without the vendor, so a narrow chip cuts the vendor and not the version. */
const shortModel = (name: string): string => name.slice(name.lastIndexOf('/') + 1);

export interface LogUsageProps {
    entries: ReadonlyArray<UsageEntry>;
    filter?: UsageFilter;
    onFilter?: (next: UsageFilter) => void;
}

export function LogUsage({ entries, filter = NO_USAGE_FILTER, onFilter }: LogUsageProps) {
    const [open, setOpen] = useState(readOpen);
    const [showAll, setShowAll] = useState(false);
    const [sort, setSort] = useState(DEFAULT_STEP_SORT);
    const { all, shown } = filterUsage(entries, filter);
    if (all.calls <= 0) return null;

    const filtered = isUsageFilterActive(filter);
    const drawn = USAGE_PARTS.filter((part) => shown.parts[part] > 0);
    const describe = (part: UsagePart): string =>
        `${PART_LABELS[part]}: ${shown.parts[part].toLocaleString()} tokens, ${formatShare(shown.parts[part] / (shown.tokens || 1))}`;
    // A picked step stays in view even when it is not among the largest.
    const sorted = sortSteps(all.steps, sort);
    const steps = showAll
        ? sorted
        : sorted.filter((step, index) => index < STEPS_SHOWN || filter.steps.includes(step.name));
    /** A column heading that sorts the table; the arrow marks the column in use and its direction. */
    const heading = (key: StepSortKey, label: string, cell: string) => (
        <th className={`font-normal ${cell}`} aria-sort={sort.key !== key ? undefined : sort.descending ? 'descending' : 'ascending'}>
            <button
                type="button"
                onClick={() => setSort(nextStepSort(sort, key))}
                className={`inline-flex items-center gap-1 py-1.5 px-2 hover:text-ink-900 ${cell.includes('text-right') ? 'flex-row-reverse' : ''} ${sort.key === key ? 'text-ink-900 font-bold' : ''}`}
                data-testid={`log-usage-sort-${key}`}
            >
                {label}
                {sort.key === key && (
                    <ChevronDown size={12} className={sort.descending ? '' : 'rotate-180'} aria-hidden="true" />
                )}
            </button>
        </th>
    );
    const anyCost = all.cost !== null;
    const manyModels = all.models.length > 1;
    const toggle = (): void => {
        saveOpen(!open);
        setOpen(!open);
    };
    const pick = (kind: UsageFilterKind, value: string): void => onFilter?.(toggleUsageFilter(filter, kind, value));
    const state = (kind: UsageFilterKind, value: string): 'picked' | 'muted' | 'plain' =>
        filter[kind].includes(value) ? 'picked' : filter[kind].length > 0 ? 'muted' : 'plain';

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
                className="flex w-full min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-left"
                data-testid="log-usage-toggle"
            >
                <span className="text-ink-900 font-bold text-lg" title={`${shown.tokens.toLocaleString()} tokens`}>
                    {formatTokenCount(shown.tokens)}{' '}
                    <span className="text-sm font-normal text-ink-500" data-testid="log-usage-calls">
                        tokens in {shown.calls.toLocaleString()}
                        {filtered ? ` of ${all.calls.toLocaleString()}` : ''} {all.calls === 1 ? 'call' : 'calls'}
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
                        className={`text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </span>
            </button>

            {filtered && (
                <button
                    type="button"
                    onClick={() => onFilter?.(NO_USAGE_FILTER)}
                    className={`${TEXT_BUTTON} block py-1`}
                    data-testid="log-usage-clear"
                >
                    Clear filters
                </button>
            )}

            <div className="flex h-2 w-full gap-0.5" role="img" aria-label={drawn.map(describe).join('. ')}>
                {drawn.map((part) => (
                    <span
                        key={part}
                        className="h-full rounded-full"
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
                                    {formatTokenCount(shown.parts[part])}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <ul className="flex flex-wrap gap-1.5 text-xs" data-testid="log-usage-models">
                        {all.models.map((model) => {
                            const s = state('models', model.name);
                            return (
                                <li key={model.name} className="min-w-0">
                                    <button
                                        type="button"
                                        className={`${CHIP} ${s === 'picked' ? CHIP_PICKED : CHIP_PLAIN} ${s === 'muted' ? MUTED : ''}`}
                                        aria-pressed={s === 'picked'}
                                        onClick={() => pick('models', model.name)}
                                        title={`${model.name}: ${model.tokens.toLocaleString()} tokens in ${model.calls.toLocaleString()} ${model.calls === 1 ? 'call' : 'calls'}`}
                                    >
                                        <span className="truncate">{shortModel(model.name)}</span>
                                        <span className="font-bold">{formatTokenCount(model.tokens)}</span>
                                        {model.cost && (
                                            <span className={s === 'picked' ? '' : 'text-gold-ink'}>
                                                {formatCallCost(model.cost)}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-ink-500 border-b border-edge">
                                {heading('name', 'Step', 'text-left')}
                                {manyModels && heading('model', 'Model', 'text-left hidden md:table-cell')}
                                {heading('calls', 'Calls', 'text-right hidden sm:table-cell')}
                                {heading('tokens', 'Tokens', 'text-right')}
                                {anyCost && heading('cost', 'Cost', 'text-right')}
                                <th className="text-right font-normal py-1.5 px-2 hidden sm:table-cell">Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {steps.map((step) => {
                                const s = state('steps', step.name);
                                return (
                                    <tr
                                        key={step.name}
                                        onClick={() => pick('steps', step.name)}
                                        className={`border-b border-edge last:border-b-0 cursor-pointer transition hover:bg-inset ${s === 'picked' ? 'bg-inset shadow-[inset_3px_0_0_var(--ink-900)]' : ''} ${s === 'muted' ? MUTED : ''}`}
                                    >
                                        <td className={`px-2 text-ink-800 break-words ${s === 'picked' ? 'font-bold' : 'font-medium'}`}>
                                            <button
                                                type="button"
                                                className="block w-full py-3 sm:py-2 text-left"
                                                aria-pressed={s === 'picked'}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    pick('steps', step.name);
                                                }}
                                            >
                                                {step.name}
                                            </button>
                                        </td>
                                        {manyModels && (
                                            <td
                                                className="py-2 px-2 font-mono text-xs text-ink-500 hidden md:table-cell"
                                                title={step.models.join(', ')}
                                            >
                                                {step.models.length === 1
                                                    ? shortModel(step.models[0])
                                                    : `${step.models.length} models`}
                                            </td>
                                        )}
                                        <td className="py-2 px-2 text-right font-mono text-ink-500 hidden sm:table-cell">
                                            {step.calls.toLocaleString()}
                                        </td>
                                        <td
                                            className="py-2 px-2 text-right font-mono font-bold text-ink-900 whitespace-nowrap"
                                            title={`${step.tokens.toLocaleString()} tokens`}
                                        >
                                            {formatTokenCount(step.tokens)}
                                        </td>
                                        {anyCost && (
                                            <td className="py-2 px-2 text-right font-mono text-ink-700 whitespace-nowrap">
                                                {step.cost ? formatCallCost(step.cost) : ''}
                                            </td>
                                        )}
                                        <td className="py-2 px-2 text-right font-mono text-ink-700 hidden sm:table-cell">
                                            {formatShare(step.share)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {all.steps.length > STEPS_SHOWN && (
                        <button
                            type="button"
                            onClick={() => setShowAll((every) => !every)}
                            className={`${TEXT_BUTTON} py-1`}
                            aria-expanded={showAll}
                            data-testid="log-usage-more"
                        >
                            {showAll ? 'Show fewer' : `Show all ${all.steps.length} steps`}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
