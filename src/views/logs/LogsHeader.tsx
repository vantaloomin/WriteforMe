/**
 * @module views/logs/LogsHeader
 * The top of the log: its name, the actions on the whole log (clear, copy, export) and the tabs
 * that pick a kind of entry. A tab is shown only when the log has entries of its kind. All
 * five fit one row on a phone: waits between retries have no tab of their own, because they
 * only mean something beside the call that caused them, under All. Clearing asks once, on the
 * button itself, and sits at the far left.
 */

import { useState } from 'react';
import { ChevronDown, Copy, Download, History, Trash2 } from '@/components/icons';
import { VIEW_LABELS } from '@/config';

export const LOG_TABS = ['all', 'calls', 'errors', 'validations', 'audio'] as const;
export type LogTab = (typeof LOG_TABS)[number];

export interface LogTabEntry {
    status?: string;
    isError?: boolean;
    isDelay?: boolean;
    isValidation?: boolean;
    isAudio?: boolean;
    category?: string;
    stepId?: unknown;
    tierName?: string;
}

/** True when the entry belongs under the tab. An unknown tab shows everything. */
export function inLogTab(entry: LogTabEntry, tab: string): boolean {
    const failed = entry.status === 'error' || entry.status === 'validation_failed' || Boolean(entry.isError);
    if (tab === 'calls') return !entry.isDelay && !entry.isValidation && !entry.isAudio && !failed;
    if (tab === 'errors') return failed;
    if (tab === 'validations') return Boolean(entry.isValidation);
    if (tab === 'audio') {
        return Boolean(
            entry.isAudio ||
                entry.category === 'audio' ||
                entry.stepId === 22 ||
                entry.tierName === 'Tier 7.0: Audio Drama'
        );
    }
    return true;
}

const ACTION =
    'min-h-9 px-3 rounded-lg font-bold text-xs bg-surface hover:bg-wash text-ink-800 border border-edge-strong transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
const MENU_ITEM = 'w-full text-left px-3.5 py-2.5 font-bold text-ink-800 hover:bg-mist-100 cursor-pointer';

export interface LogsHeaderProps {
    entries: ReadonlyArray<LogTabEntry>;
    /** Entries the tab and the usage filters leave in view: what copy and export act on. */
    visibleCount: number;
    logFilter: string;
    setLogFilter: (tab: LogTab) => void;
    onCopy: () => void;
    onExportText: () => void;
    onExportJson: () => void;
    onClear: () => void;
}

export function LogsHeader({
    entries,
    visibleCount,
    logFilter,
    setLogFilter,
    onCopy,
    onExportText,
    onExportJson,
    onClear
}: LogsHeaderProps) {
    const [exportOpen, setExportOpen] = useState(false);
    const [confirmingClear, setConfirmingClear] = useState(false);
    const countIn = (tab: LogTab): number => entries.filter((entry) => inLogTab(entry, tab)).length;
    const tabs = LOG_TABS.filter((tab) => tab === 'all' || tab === 'calls' || tab === logFilter || countIn(tab) > 0);
    const errors = countIn('errors');
    const exportAs = (run: () => void) => () => {
        run();
        setExportOpen(false);
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-2">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-ink-900 flex items-center gap-2.5">
                <History className="text-gold-ink" /> {VIEW_LABELS.logs}
            </h2>

            <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
                {entries.length > 0 && (
                    <button
                        onClick={() => {
                            if (confirmingClear) onClear();
                            setConfirmingClear(!confirmingClear);
                        }}
                        onBlur={() => setConfirmingClear(false)}
                        className={
                            confirmingClear
                                ? 'min-h-9 px-3 rounded-lg font-bold text-xs bg-blush-tint text-blush-600 border border-blush-600 cursor-pointer'
                                : 'min-h-9 min-w-9 rounded-lg text-ink-400 hover:text-blush-600 hover:bg-blush-tint transition-colors flex items-center justify-center cursor-pointer'
                        }
                        title="Clear log"
                        aria-label="Clear log"
                    >
                        {confirmingClear ? (
                            `Clear all ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}?`
                        ) : (
                            <Trash2 size={15} />
                        )}
                    </button>
                )}
                <button onClick={onCopy} disabled={visibleCount === 0} className={ACTION}>
                    <Copy size={13} /> Copy log
                </button>
                <div className="relative">
                    <button
                        onClick={() => setExportOpen(!exportOpen)}
                        disabled={visibleCount === 0}
                        className={ACTION}
                        aria-expanded={exportOpen}
                    >
                        <Download size={13} /> Export
                        <ChevronDown size={11} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {exportOpen && (
                        <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-40 bg-surface border border-edge-strong rounded-xl shadow-xl z-30 py-1 text-xs animate-fade-in">
                            <button onClick={exportAs(onExportText)} className={MENU_ITEM}>
                                Text (.txt)
                            </button>
                            <button onClick={exportAs(onExportJson)} className={`${MENU_ITEM} border-t border-edge-soft`}>
                                JSON (.json)
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-nowrap items-center gap-0.5 sm:gap-1 min-w-0 max-w-full overflow-x-auto no-scrollbar touch-scroll bg-surface p-1 rounded-xl border border-edge-strong text-xs">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setLogFilter(tab)}
                            aria-pressed={logFilter === tab}
                            className={`min-h-11 sm:min-h-8 px-2 sm:px-3 rounded-lg font-bold capitalize whitespace-nowrap shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
                                logFilter === tab
                                    ? 'bg-btn text-btn-ink'
                                    : 'text-ink-600 hover:text-ink-900 hover:bg-lift'
                            }`}
                        >
                            {tab}
                            {tab === 'errors' && errors > 0 && (
                                <span className="text-[10px] font-mono font-bold bg-rose-600 text-white px-1.5 rounded-full">
                                    {errors > 99 ? '99+' : errors}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
