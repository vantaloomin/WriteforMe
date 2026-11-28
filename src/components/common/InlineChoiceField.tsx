/**
 * @module components/common/InlineChoiceField
 * A short value edited where it sits: click it, pick from a list or type, Enter or click
 * away to save, Escape to cancel. For fields of a few words, not for prose.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from '@/components/icons';
import type { ChoiceOption } from '@/config';

export interface InlineChoiceFieldProps {
    /** Names the field for assistive tech, e.g. "Role". */
    label: string;
    value: string;
    options?: ChoiceOption[];
    /** When false the value must be one of `options`. */
    allowCustom?: boolean;
    placeholder?: string;
    onCommit: (value: string) => void;
    /** Classes for the resting value, so it can look like a heading or a pill. */
    className?: string;
}

export function InlineChoiceField({
    label,
    value,
    options = [],
    allowCustom = true,
    placeholder,
    onCommit,
    className = ''
}: InlineChoiceFieldProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const [active, setActive] = useState(-1);
    const root = useRef<HTMLSpanElement>(null);
    const listId = useId();

    const shown = options.find((option) => option.value === value)?.label || value;
    const query = draft.trim().toLowerCase();
    const typed = allowCustom && query !== value.trim().toLowerCase();
    const visible = typed
        ? options.filter((option) => option.label.toLowerCase().includes(query))
        : options;

    const close = () => {
        setOpen(false);
        setActive(-1);
    };
    const commit = (next: string) => {
        const clean = next.trim();
        if (clean && clean !== value) onCommit(clean);
        close();
    };
    const commitDraft = () => {
        if (active >= 0 && visible[active]) commit(visible[active].value);
        else if (allowCustom) commit(draft);
        else close();
    };

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (root.current?.contains(event.target as Node)) return;
            if (allowCustom) commit(draft);
            else close();
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    });

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            commitDraft();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!visible.length) return;
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActive((index) => (index + step + visible.length) % visible.length);
        }
    };

    if (!open) {
        return (
            <button
                type="button"
                aria-label={`Edit ${label}: ${shown || placeholder || 'not set'}`}
                onClick={() => {
                    setDraft(allowCustom ? value : '');
                    setOpen(true);
                }}
                className={`group inline-flex items-center gap-1 max-w-full min-w-0 text-left cursor-pointer rounded-md hover:bg-wash focus-visible:ring-1 focus-visible:ring-gold outline-none transition-colors ${className}`}
            >
                <span className="break-words min-w-0">{shown || placeholder}</span>
                {options.length > 0 && (
                    <ChevronDown
                        size={11}
                        className="shrink-0 opacity-50 group-hover:opacity-100"
                    />
                )}
            </button>
        );
    }

    return (
        <span ref={root} className="relative inline-block max-w-full align-middle">
            {allowCustom ? (
                <input
                    autoFocus
                    role="combobox"
                    aria-label={label}
                    aria-expanded={visible.length > 0}
                    aria-controls={listId}
                    value={draft}
                    placeholder={placeholder}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => {
                        setDraft(event.target.value);
                        setActive(-1);
                    }}
                    onKeyDown={onKeyDown}
                    size={Math.max(8, draft.length + 1)}
                    className="max-w-full bg-inset border border-gold rounded-lg px-2 py-1 text-base sm:text-xs text-ink-900 outline-none focus:ring-1 focus:ring-gold/40"
                />
            ) : (
                <button
                    type="button"
                    autoFocus
                    role="combobox"
                    aria-label={label}
                    aria-expanded
                    aria-controls={listId}
                    onKeyDown={onKeyDown}
                    onClick={close}
                    className="inline-flex items-center gap-1 bg-inset border border-gold rounded-lg px-2 py-1 text-xs text-ink-900 outline-none"
                >
                    {shown || placeholder} <ChevronDown size={11} />
                </button>
            )}
            {visible.length > 0 && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label={label}
                    className="absolute left-0 top-full mt-1 z-30 min-w-[11rem] max-h-64 overflow-y-auto bg-surface border border-edge-strong rounded-xl shadow-lg p-1"
                >
                    {visible.map((option, index) => (
                        <li
                            key={option.value}
                            role="option"
                            aria-selected={option.value === value}
                            onPointerDown={(event) => {
                                event.preventDefault();
                                commit(option.value);
                            }}
                            onPointerEnter={() => setActive(index)}
                            className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer whitespace-nowrap ${
                                index === active ? 'bg-wash text-ink-900' : 'text-ink-700'
                            }`}
                        >
                            {option.label}
                            {option.value === value && (
                                <Check size={12} className="text-gold-ink" />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </span>
    );
}
