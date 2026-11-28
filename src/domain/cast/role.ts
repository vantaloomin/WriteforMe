/**
 * @module domain/cast/role
 * Keeps a character's `role` a short label. Models tend to answer `<role>` with a paragraph
 * about the character; that paragraph is worth keeping, so it moves to `summary`.
 */

import { CORNER_DEFAULT_STORY_ROLE, STORY_ROLE_PRESETS } from '@/config';

export const SHORT_ROLE_LIMITS = { words: 4, chars: 40 } as const;

/** Labels a long role can be reduced to: the presets, then a few words models use for them. */
const KNOWN_ROLE_LABELS = [
    ...STORY_ROLE_PRESETS.map((option) => option.value),
    'Opponent',
    'Rival',
    'Ally'
];

const OPENING_LABEL_WORDS = 6;
const CORNER_WORDS = /\b(main character|challenger|comforter|warning)\b/;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** True when the text reads as a label (a few words, no sentence in it). */
export function isShortRole(role: unknown): boolean {
    const value = text(role);
    return (
        value.length <= SHORT_ROLE_LIMITS.chars &&
        value.split(/\s+/).filter(Boolean).length <= SHORT_ROLE_LIMITS.words &&
        !/[.!?;\n]/.test(value)
    );
}

export interface SplitRole {
    role: string;
    summary: string;
}

/**
 * Splits what a model wrote for `role`. A label is kept as it is. A paragraph becomes the
 * summary, and the role is the first known label its opening sentence names, else the usual
 * role for the character's corner, else Supporting.
 */
export function splitCharacterRole(rawRole: unknown, cornerRole?: unknown): SplitRole {
    const raw = text(rawRole);
    if (isShortRole(raw)) return { role: raw, summary: '' };
    const opening = raw.split(/[.!?\n]/)[0].toLowerCase();
    const named = KNOWN_ROLE_LABELS.map((label) => ({
        label,
        at: opening.search(new RegExp(`\\b${label.toLowerCase()}\\b`))
    }))
        .filter((hit) => hit.at !== -1)
        .sort((a, b) => a.at - b.at)[0];
    // A short opening sentence ("The Comforter and safe haven.") only restates the role.
    const rest = raw.replace(/^[^.!?\n]*[.!?\n]\s*/, '');
    const restatesRole =
        rest &&
        (named || CORNER_WORDS.test(opening)) &&
        opening.split(/\s+/).filter(Boolean).length <= OPENING_LABEL_WORDS;
    return {
        role: named?.label || CORNER_DEFAULT_STORY_ROLE[text(cornerRole)] || 'Supporting',
        summary: restatesRole ? rest : raw
    };
}

interface RoleHolder {
    role?: unknown;
    summary?: unknown;
    corner_role?: unknown;
}

/**
 * The same character with a short role. A long role moves to `summary` unless the character
 * already has one. Returns the object it was given when nothing needs to change.
 */
export function withShortRole<T extends RoleHolder>(member: T): T {
    if (!member || isShortRole(member.role)) return member;
    const split = splitCharacterRole(member.role, member.corner_role);
    return { ...member, role: split.role, summary: text(member.summary) || split.summary };
}

/** Repairs every character in a stored cast. Returns the same array when none needed it. */
export function shortenCastRoles<T>(cast: T): T {
    if (!Array.isArray(cast)) return cast;
    const next = cast.map((member) =>
        member && typeof member === 'object' ? withShortRole(member as RoleHolder) : member
    );
    return (next.some((member, i) => member !== cast[i]) ? next : cast) as T;
}
