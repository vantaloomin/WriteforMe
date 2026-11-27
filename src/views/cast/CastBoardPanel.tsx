/**
 * @module views/cast/CastBoardPanel
 * The cast board on the Cast page: a theme question, the four sides of a genre template with what
 * each stands for and who is on it, and the list of cast checks. The checks need no model and
 * change nothing; each says what is wrong and how to fix it.
 */

import React, { useMemo } from 'react';
import {
    CAST_BOARD_LIMITS,
    CAST_GENRE_TEMPLATES,
    boardFromTemplate,
    boardKey,
    castChecks,
    castGenreTemplate,
    normalizeCastBoard,
    placeOnSide,
    type CastBoard,
    type CheckedCastMember
} from '@/domain/cast';

export interface CastBoardStory {
    cast?: CheckedCastMember[];
    relationships?: Record<string, unknown> | unknown[] | null;
    cast_board?: unknown;
    [key: string]: unknown;
}

export interface CastBoardPanelProps<TStory extends CastBoardStory> {
    story: TStory;
    setStory: (updater: (prev: TStory) => TStory) => unknown;
}

const OWN_SIDES = 'own';
const field =
    'w-full px-2.5 py-1.5 rounded-lg border border-edge-strong bg-surface text-xs text-ink-900 outline-none focus:ring-1 focus:ring-gold-edge';

export function CastBoardPanel<TStory extends CastBoardStory>({ story, setStory }: CastBoardPanelProps<TStory>) {
    const board = useMemo(() => normalizeCastBoard(story.cast_board), [story.cast_board]);
    const checks = useMemo(() => castChecks(story), [story]);
    const cast = (story.cast || []).filter(Boolean);
    const template = board ? castGenreTemplate(board.genre) : null;
    const warnings = checks.filter((check) => check.severity === 'warn').length;

    const save = (next: CastBoard | null): void => {
        setStory((prev) => {
            if (next) return { ...prev, cast_board: next };
            const rest = { ...prev };
            delete rest.cast_board;
            return rest;
        });
    };

    const chooseTemplate = (value: string): void => {
        if (!value) return save(null);
        if (value === OWN_SIDES) {
            return save({
                genre: '',
                theme: board?.theme || '',
                sides: Array.from({ length: CAST_BOARD_LIMITS.sides }, (_, index) => ({
                    label: board?.sides[index]?.label || `Side ${index + 1}`,
                    stance: board?.sides[index]?.stance || '',
                    members: [...(board?.sides[index]?.members || [])]
                }))
            });
        }
        save(boardFromTemplate(value, board));
    };

    const setSide = (index: number, patch: { label?: string; stance?: string }): void => {
        if (!board) return;
        save({ ...board, sides: board.sides.map((side, i) => (i === index ? { ...side, ...patch } : side)) });
    };

    const known = new Set(cast.flatMap((member) => [String(member.id || ''), String(member.name || '')]).filter(Boolean));
    const hasMissing = Boolean(board?.sides.some((side) => side.members.some((key) => !known.has(key))));
    const clearMissing = (): void => {
        if (!board) return;
        save({ ...board, sides: board.sides.map((side) => ({ ...side, members: side.members.filter((key) => known.has(key)) })) });
    };

    return (
        <details
            className="bg-surface rounded-2xl border border-edge shadow-sm"
            data-testid="cast-board"
            open={Boolean(board)}
        >
            <summary className="p-5 cursor-pointer select-none flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-ink-900 font-serif">Cast Board &amp; Checks</span>
                <span
                    className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${
                        warnings > 0 ? 'bg-gold-tint border-gold-edge text-gold-ink' : 'bg-inset border-edge-strong text-ink-500'
                    }`}
                    data-testid="cast-check-count"
                >
                    {warnings === 0 ? 'No warnings' : `${warnings} warning${warnings === 1 ? '' : 's'}`}
                </span>
            </summary>

            <div className="px-5 pb-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="space-y-1 text-xs text-ink-700">
                        <span className="block font-bold">Sides</span>
                        <select
                            value={board ? board.genre || OWN_SIDES : ''}
                            onChange={(e) => chooseTemplate(e.target.value)}
                            aria-label="Cast board template"
                            className={field}
                        >
                            <option value="">No board</option>
                            <option value={OWN_SIDES}>My own four sides</option>
                            {CAST_GENRE_TEMPLATES.map((genre) => (
                                <option key={genre.id} value={genre.id}>
                                    {genre.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {board && (
                        <label className="space-y-1 text-xs text-ink-700 sm:col-span-2">
                            <span className="block font-bold">Theme question</span>
                            <input
                                key={`theme-${board.genre}`}
                                type="text"
                                defaultValue={board.theme}
                                maxLength={CAST_BOARD_LIMITS.theme}
                                placeholder="The one question the story asks, such as: Is order worth what it costs?"
                                onBlur={(e) => {
                                    if (e.target.value.trim() !== board.theme) save({ ...board, theme: e.target.value.trim() });
                                }}
                                aria-label="Theme question"
                                className={field}
                            />
                        </label>
                    )}
                </div>

                {!board && (
                    <p className="text-xs text-ink-500">
                        A board lays the cast out on four sides and says what each side stands for. Pick a genre to start
                        from its usual four sides. The checks below work without a board.
                    </p>
                )}
                {template && (
                    <p className="text-xs text-ink-500">
                        {template.help} Inside one side: {template.insideFight}
                    </p>
                )}

                {board && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {board.sides.map((side, index) => (
                            <div
                                key={`${board.genre}-${index}`}
                                className="p-3 bg-inset border border-edge-strong rounded-xl space-y-2"
                                data-testid={`cast-side-${index}`}
                            >
                                <input
                                    key={`label-${board.genre}-${index}-${side.label}`}
                                    type="text"
                                    defaultValue={side.label}
                                    maxLength={CAST_BOARD_LIMITS.label}
                                    onBlur={(e) => {
                                        if (e.target.value.trim() !== side.label) setSide(index, { label: e.target.value.trim() });
                                    }}
                                    aria-label={`Side ${index + 1} name`}
                                    className={`${field} font-bold`}
                                />
                                <textarea
                                    key={`stance-${board.genre}-${index}`}
                                    defaultValue={side.stance}
                                    maxLength={CAST_BOARD_LIMITS.stance}
                                    rows={2}
                                    placeholder={template?.sides[index]?.hint || 'What this side stands for: why it fights'}
                                    onBlur={(e) => {
                                        if (e.target.value.trim() !== side.stance) setSide(index, { stance: e.target.value.trim() });
                                    }}
                                    aria-label={`What ${side.label || `side ${index + 1}`} stands for`}
                                    className={field}
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    {cast.map((member, memberIndex) => {
                                        const key = boardKey(member);
                                        if (!key) return null;
                                        const here = side.members.includes(key);
                                        return (
                                            <button
                                                key={`${key}-${memberIndex}`}
                                                type="button"
                                                aria-pressed={here}
                                                onClick={() => save(placeOnSide(board, key, here ? -1 : index))}
                                                className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer ${
                                                    here
                                                        ? 'bg-btn text-btn-ink border-transparent font-bold'
                                                        : 'bg-surface text-ink-500 border-edge-strong hover:bg-wash'
                                                }`}
                                            >
                                                {member.name || `Character ${memberIndex + 1}`}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {board && hasMissing && (
                    <button
                        type="button"
                        onClick={clearMissing}
                        className="text-xs px-2.5 py-1 rounded-lg border border-edge-strong text-ink-700 hover:bg-wash cursor-pointer"
                    >
                        Clear missing
                    </button>
                )}

                <div className="space-y-2" aria-label="Cast checks">
                    <span className="text-xs font-bold text-ink-900 uppercase tracking-wider font-mono">Checks</span>
                    {checks.length === 0 && (
                        <p className="text-xs text-ink-500 italic">
                            {cast.length === 0 ? 'There is no cast to check yet.' : 'Nothing to flag.'}
                        </p>
                    )}
                    <ul className="space-y-1.5">
                        {checks.map((check, index) => (
                            <li key={`${check.code}-${index}`} className="text-xs text-ink-700 flex gap-2">
                                <span
                                    className={`shrink-0 font-mono uppercase text-[10px] px-1.5 py-0.5 rounded border h-fit ${
                                        check.severity === 'warn'
                                            ? 'bg-gold-tint border-gold-edge text-gold-ink'
                                            : 'bg-inset border-edge-strong text-ink-500'
                                    }`}
                                >
                                    {check.severity === 'warn' ? 'Check' : 'Note'}
                                </span>
                                <span>
                                    {check.message} <span className="text-ink-500">{check.fix}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </details>
    );
}
