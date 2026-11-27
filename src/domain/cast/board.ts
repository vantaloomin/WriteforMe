/**
 * @module domain/cast/board
 * The cast board: the story's people laid out on the four sides of a genre template, with what
 * each side stands for. It is the author's plan, kept on the story as `cast_board`. Nothing here
 * calls a model.
 */

import { CAST_GENRE_TEMPLATES, type CastGenreTemplate } from './templateData';

export interface CastBoardSide {
    label: string;
    /** What this side stands for: why it fights. */
    stance: string;
    /** Ids (or names, for a character without an id) of the cast members on this side. */
    members: string[];
}

export interface CastBoard {
    /** Id of the genre template the sides came from, or '' for sides written by hand. */
    genre: string;
    /** The one question the story asks. */
    theme: string;
    sides: CastBoardSide[];
}

export const CAST_BOARD_LIMITS = { sides: 4, label: 80, stance: 200, theme: 300, members: 24 } as const;

export interface BoardCastMember {
    id?: string;
    name?: string;
    [key: string]: unknown;
}

const clean = (value: unknown, limit: number): string => (typeof value === 'string' ? value.trim().slice(0, limit) : '');

export function castGenreTemplate(id: string): CastGenreTemplate | null {
    return CAST_GENRE_TEMPLATES.find((template) => template.id === id) || null;
}

/** The key a board uses for a cast member: the id, else the name. */
export function boardKey(member: BoardCastMember | null | undefined): string {
    return String(member?.id || member?.name || '').trim();
}

/** A stored board made safe to use, or null when the story has none. */
export function normalizeCastBoard(raw: unknown): CastBoard | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const source = raw as Record<string, unknown>;
    if (!Array.isArray(source.sides)) return null;
    const sides: CastBoardSide[] = source.sides.slice(0, CAST_BOARD_LIMITS.sides).map((item) => {
        const side = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const members = Array.isArray(side.members)
            ? [...new Set(side.members.filter((m): m is string => typeof m === 'string' && Boolean(m.trim())))]
            : [];
        return {
            label: clean(side.label, CAST_BOARD_LIMITS.label),
            stance: clean(side.stance, CAST_BOARD_LIMITS.stance),
            members: members.slice(0, CAST_BOARD_LIMITS.members)
        };
    });
    if (sides.length === 0) return null;
    const genre = clean(source.genre, 40);
    return { genre: castGenreTemplate(genre) ? genre : '', theme: clean(source.theme, CAST_BOARD_LIMITS.theme), sides };
}

/**
 * A board laid out from a genre template. Sides keep the stance and the people the previous
 * board had in the same position, so trying another template loses nothing.
 */
export function boardFromTemplate(genreId: string, previous: CastBoard | null = null): CastBoard | null {
    const template = castGenreTemplate(genreId);
    if (!template) return null;
    return {
        genre: template.id,
        theme: previous?.theme || '',
        sides: template.sides.map((side, index) => ({
            label: side.label,
            stance: previous?.sides[index]?.stance || '',
            members: [...(previous?.sides[index]?.members || [])]
        }))
    };
}

/** Puts a cast member on one side (and off every other), or off the board with side -1. */
export function placeOnSide(board: CastBoard, memberKey: string, sideIndex: number): CastBoard {
    const key = memberKey.trim();
    if (!key) return board;
    return {
        ...board,
        sides: board.sides.map((side, index) => {
            const without = side.members.filter((m) => m !== key);
            return { ...side, members: index === sideIndex ? [...without, key] : without };
        })
    };
}

/** The side a cast member is on, or null. Matches by id first, then by name. */
export function sideOfMember(board: CastBoard | null, member: BoardCastMember | null | undefined): CastBoardSide | null {
    if (!board || !member) return null;
    const keys = [String(member.id || '').trim(), String(member.name || '').trim()].filter(Boolean);
    return board.sides.find((side) => side.members.some((m) => keys.includes(m))) || null;
}

/** "The patron: what the quest is really for" for a prompt, or '' when the side says nothing yet. */
export function sideLine(side: CastBoardSide | null): string {
    if (!side || !side.label) return '';
    return side.stance ? `${side.label}: ${side.stance}` : side.label;
}
