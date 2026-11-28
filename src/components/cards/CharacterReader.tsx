/**
 * @module components/cards/CharacterReader
 * One character at reading size: a large dialog (full screen on a phone) with a tab per long
 * text, so an interview or a sheet is read in a full column instead of a small scroll box.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from '@/components/icons';
import { cornerRoleLabel } from '@/config';
import { parseMarkdown } from '@/utils';
import { EditButton } from '../common/EditButton';
import type { CharacterCardCharacter } from './CharacterCard';
import {
    characterReaderSections,
    defaultReaderSection,
    type ReaderSectionId
} from './characterReaderSections';

export interface CharacterReaderProps {
    character: CharacterCardCharacter;
    /** The tab to open on. Without one, or when the character lacks it, the longest text opens. */
    section?: ReaderSectionId;
    onSectionChange?: (section: ReaderSectionId) => void;
    portraitSrc?: string | null;
    onClose: () => void;
    /** Moves to the previous (-1) or next (1) character. Leave out to hide the arrows. */
    onStep?: (delta: -1 | 1) => void;
    hasPrevious?: boolean;
    hasNext?: boolean;
    onEdit?: (fieldPath: string, label: string, currentValue: string) => void;
}

const ICON_BUTTON =
    'w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-ink-600 hover:text-ink-900 hover:bg-wash transition-colors disabled:opacity-30 disabled:pointer-events-none';

const isTyping = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

export function CharacterReader({
    character,
    section,
    portraitSrc,
    onSectionChange,
    onClose,
    onStep,
    hasPrevious = true,
    hasNext = true,
    onEdit
}: CharacterReaderProps) {
    const sections = characterReaderSections(character);
    const [activeId, setActiveId] = useState<ReaderSectionId | undefined>(section);
    const active =
        sections.find((s) => s.id === activeId) ||
        sections.find((s) => s.id === defaultReaderSection(sections));
    const single = active?.parts.length === 1 ? active.parts[0] : null;
    const rootRef = useRef<HTMLDivElement | null>(null);
    const closeRef = useRef<HTMLButtonElement | null>(null);
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const pick = (id: ReaderSectionId) => {
        setActiveId(id);
        onSectionChange?.(id);
    };

    // Focus moves into the dialog and goes back to whatever opened it.
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        return () => opener?.focus?.();
    }, []);

    useEffect(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = 0;
    }, [active?.id, character]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Keys pressed in something stacked above the reader (the edit modal) are not ours.
            const target = e.target instanceof HTMLElement ? e.target : null;
            const outside =
                target && target !== document.body && !rootRef.current?.contains(target);
            if (outside || isTyping(target)) return;
            if (e.key === 'Escape') onClose();
            if (target?.getAttribute('role') === 'tab') return;
            if (e.key === 'ArrowLeft' && hasPrevious) onStep?.(-1);
            if (e.key === 'ArrowRight' && hasNext) onStep?.(1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, onStep, hasPrevious, hasNext]);

    const tags = [character.role, cornerRoleLabel(character.corner_role)].filter(Boolean);

    // Portalled to the body: the page column is a containing block, so `fixed` would stop at it.
    return createPortal(
        <div
            ref={rootRef}
            className="character-reader fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-sm md:p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label={character.name}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-surface w-full h-full md:max-w-4xl md:rounded-2xl md:border md:border-edge shadow-xl flex flex-col overflow-hidden">
                <header className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-edge">
                    {portraitSrc && (
                        <img
                            src={portraitSrc}
                            alt=""
                            className="w-10 h-[52px] rounded-lg object-cover border border-edge shrink-0"
                        />
                    )}
                    <div className="min-w-0 flex-1">
                        <h2 className="font-serif font-bold text-lg text-ink-900 truncate">
                            {character.name}
                        </h2>
                        {tags.length > 0 && (
                            <p className="text-xs text-ink-500 truncate">{tags.join(' · ')}</p>
                        )}
                    </div>
                    {onStep && (
                        <>
                            <button
                                type="button"
                                className={ICON_BUTTON}
                                aria-label="Previous character"
                                disabled={!hasPrevious}
                                onClick={() => onStep(-1)}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                type="button"
                                className={ICON_BUTTON}
                                aria-label="Next character"
                                disabled={!hasNext}
                                onClick={() => onStep(1)}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </>
                    )}
                    <button
                        ref={closeRef}
                        type="button"
                        className={`${ICON_BUTTON} ml-2`}
                        aria-label="Close"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>
                </header>

                {(sections.length > 1 || (single && onEdit)) && (
                    <div
                        role="tablist"
                        className="flex gap-1 px-3 md:px-5 border-b border-edge overflow-x-auto shrink-0 min-h-11"
                    >
                        {sections.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                role="tab"
                                aria-selected={s.id === active?.id}
                                onClick={() => pick(s.id)}
                                className={`px-3 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                                    s.id === active?.id
                                        ? 'border-gold text-ink-900'
                                        : 'border-transparent text-ink-500 hover:text-ink-800'
                                }`}
                            >
                                {s.title}
                            </button>
                        ))}
                        {single && onEdit && (
                            <EditButton
                                className="w-10 h-10 ml-auto self-center shrink-0"
                                title={single.label}
                                value={single.text}
                                onSave={() => onEdit(single.field, single.label, single.text)}
                            />
                        )}
                    </div>
                )}

                <div
                    ref={bodyRef}
                    role="tabpanel"
                    className="flex-1 overflow-y-auto custom-scrollbar"
                >
                    <div className="max-w-[40rem] mx-auto px-5 md:px-8 py-6 md:py-8 space-y-6">
                        {active?.parts.map((part) => (
                            <section key={part.field}>
                                {!single && (
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h3 className="text-sm font-semibold text-ink-500">
                                            {part.label}
                                        </h3>
                                        {onEdit && (
                                            <EditButton
                                                className="w-10 h-10 -mr-2 shrink-0"
                                                title={part.label}
                                                value={part.text}
                                                onSave={() =>
                                                    onEdit(part.field, part.label, part.text)
                                                }
                                            />
                                        )}
                                    </div>
                                )}
                                <div
                                    className="prose max-w-none font-serif [&_p]:leading-[1.7]"
                                    dangerouslySetInnerHTML={{ __html: parseMarkdown(part.text) }}
                                />
                            </section>
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
