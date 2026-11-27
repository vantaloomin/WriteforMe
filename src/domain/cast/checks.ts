/**
 * @module domain/cast/checks
 * Checks on a story's cast that need no model: the Four-Corner Web (is every corner there, does
 * each corner have what its role asks for, do two people stand for the same thing) and the cast
 * board (does every side say what it stands for and have someone on it). Every finding is a soft
 * warning with a reason and a fix. Nothing is blocked and nothing is changed.
 */

import { boardKey, castGenreTemplate, normalizeCastBoard, type BoardCastMember } from './board';

export type CastCheckSeverity = 'warn' | 'info';

export interface CastCheck {
    code: string;
    severity: CastCheckSeverity;
    /** Names of the characters or sides the finding is about. */
    about: string[];
    message: string;
    fix: string;
}

export interface CheckedCastMember extends BoardCastMember {
    role?: string;
    corner_role?: string;
    core_flaw?: string;
    core_desire?: string;
}

export interface CheckedStory {
    cast?: CheckedCastMember[] | null;
    relationships?: Record<string, unknown> | unknown[] | null;
    cast_board?: unknown;
}

/** Past this, a cast has more people than a story can give room to. */
export const MOST_CHARACTERS = 12;

/** The text a hand-added or imported character starts with; it says nothing about them yet. */
const STARTING_TEXT = new Set([
    'defending their current comfort zone or safety habit.',
    'pursuing their personal goal within the story world.',
    'unspecified flaw',
    'unspecified desire'
]);

const CORNERS: ReadonlyArray<{
    role: string;
    name: string;
    fields: ReadonlyArray<[string, string]>;
}> = [
    {
        role: 'MAIN_CHARACTER',
        name: 'Main Character',
        fields: [
            ['why_it_makes_sense', 'why their answer makes sense'],
            ['what_it_costs_them', 'what it costs them']
        ]
    },
    {
        role: 'THE_CHALLENGER',
        name: 'Challenger',
        fields: [
            ['way_of_living', 'their way of living'],
            ['why_it_is_appealing', 'why it is appealing']
        ]
    },
    {
        role: 'THE_COMFORTER',
        name: 'Comforter',
        fields: [
            ['shared_outlook', 'the outlook they share with the main character'],
            ['the_hidden_trap', 'the hidden trap']
        ]
    },
    {
        role: 'THE_WARNING',
        name: 'Warning',
        fields: [
            ['how_they_ended_up', 'how they ended up this way'],
            ['the_wake_up_call', 'the wake-up call']
        ]
    }
];

const REMINDERS: Record<string, [string, string]> = {
    THE_CHALLENGER: [
        '{} should be tempting, and still have a real flaw.',
        'Make sure their way of living costs them something too.'
    ],
    THE_COMFORTER: [
        '{} agrees with the main character; that should feel safe, not sinister.',
        'Keep the trap in what they share, not in a hidden bad intent.'
    ],
    THE_WARNING: [
        '{} should be someone the reader feels for, not a cautionary cartoon.',
        'Show how they got there one reasonable step at a time.'
    ]
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const nameOf = (member: CheckedCastMember, index: number): string => text(member.name) || `Character ${index + 1}`;

export function namesOf(names: string[]): string {
    if (names.length <= 1) return names[0] || '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** A sentence reduced to its words, so "By force." and "by force" compare equal. */
function plain(value: unknown): string {
    return text(value)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .join(' ');
}

const said = (value: unknown): string => {
    const words = plain(value);
    return STARTING_TEXT.has(`${words}.`) || STARTING_TEXT.has(words) ? '' : words;
};

function webChecks(cast: CheckedCastMember[]): CastCheck[] {
    const found: CastCheck[] = [];
    const named = cast.map((member, index) => ({ member, name: nameOf(member, index) }));

    for (const corner of CORNERS) {
        const holders = named.filter(({ member }) => text(member.corner_role).toUpperCase() === corner.role);
        if (holders.length === 0) {
            found.push({
                code: 'missing-corner',
                severity: 'warn',
                about: [],
                message: `The web has no ${corner.name} yet.`,
                fix:
                    corner.role === 'MAIN_CHARACTER'
                        ? 'Open the character the story follows and set their corner to Main Character.'
                        : `Add a character for the ${corner.name} corner, or move a supporting character into it.`
            });
            continue;
        }
        if (corner.role === 'MAIN_CHARACTER' && holders.length > 1) {
            found.push({
                code: 'two-mains',
                severity: 'warn',
                about: holders.map((h) => h.name),
                message: `${namesOf(holders.map((h) => h.name))} are all set as the Main Character.`,
                fix: 'Keep one as the Main Character and give the others a different corner.'
            });
        }
        for (const { member, name } of holders) {
            const empty = corner.fields.filter(([key]) => !text(member[key])).map(([, label]) => label);
            if (empty.length > 0) {
                found.push({
                    code: 'role-fields',
                    severity: 'warn',
                    about: [name],
                    message: `${name} (${corner.name}) has nothing yet for ${empty.join(' or ')}.`,
                    fix: 'Fill in what this corner asks for on their card.'
                });
            }
        }
        const reminder = REMINDERS[corner.role];
        if (reminder) {
            found.push({
                code: 'corner-reminder',
                severity: 'info',
                about: holders.map((h) => h.name),
                message: reminder[0].replace('{}', namesOf(holders.map((h) => h.name))),
                fix: reminder[1]
            });
        }
    }

    const cornered = named.filter(({ member }) => {
        const role = text(member.corner_role).toUpperCase();
        return role && role !== 'SUPPORTING';
    });
    const blank = cornered.filter(({ member }) => !said(member.core_flaw) || !said(member.core_desire));
    if (blank.length > 0) {
        found.push({
            code: 'blank-drive',
            severity: 'warn',
            about: blank.map((b) => b.name),
            message: `${namesOf(blank.map((b) => b.name))} ${blank.length === 1 ? 'has' : 'have'} no flaw or no desire of their own yet.`,
            fix: 'Write what each one wants and the habit that gets in their way.'
        });
    }
    for (let i = 0; i < cornered.length; i += 1) {
        for (let j = i + 1; j < cornered.length; j += 1) {
            const one = said(cornered[i].member.core_desire);
            if (one && one === said(cornered[j].member.core_desire)) {
                found.push({
                    code: 'duplicate-why',
                    severity: 'warn',
                    about: [cornered[i].name, cornered[j].name],
                    message: `${cornered[i].name} and ${cornered[j].name} want the same thing, in the same words.`,
                    fix: 'Give one of them a different desire, or merge them.'
                });
            }
        }
    }

    const seen = new Map<string, string>();
    const twice = new Set<string>();
    for (const { name } of named) {
        const key = name.toLowerCase();
        if (seen.has(key)) twice.add(seen.get(key) as string);
        else seen.set(key, name);
    }
    if (twice.size > 0) {
        found.push({
            code: 'same-name',
            severity: 'warn',
            about: [...twice],
            message: `More than one character is named ${namesOf([...twice])}.`,
            fix: 'Rename or remove one, so scenes and relationships cannot mix them up.'
        });
    }

    if (cast.length > MOST_CHARACTERS) {
        found.push({
            code: 'cast-bloat',
            severity: 'warn',
            about: [],
            message: `The cast has ${cast.length} characters; past ${MOST_CHARACTERS}, some will have nothing to do.`,
            fix: 'Merge two characters, or leave a group unnamed.'
        });
    }
    return found;
}

function relationshipChecks(cast: CheckedCastMember[], relationships: CheckedStory['relationships']): CastCheck[] {
    if (!relationships || Array.isArray(relationships) || typeof relationships !== 'object') return [];
    const known = new Set<string>();
    cast.forEach((member) => {
        if (text(member.name)) known.add(text(member.name).toLowerCase());
        if (text(member.id)) known.add(text(member.id).toLowerCase());
    });
    // A relationship may name someone by part of their name ("Mara" for "Mara Vance").
    const isKnown = (end: string): boolean => {
        const wanted = end.toLowerCase();
        if (known.has(wanted)) return true;
        return [...known].some((name) => name.split(/\s+/).includes(wanted) || wanted.split(/\s+/).includes(name));
    };
    const gone = new Set<string>();
    for (const key of Object.keys(relationships)) {
        if (!key.includes('->')) continue;
        for (const end of key.split('->').map((part) => part.trim())) {
            if (end && !isKnown(end)) gone.add(end);
        }
    }
    if (gone.size === 0) return [];
    return [
        {
            code: 'missing-character',
            severity: 'warn',
            about: [...gone],
            message: `Relationships name ${namesOf([...gone])}, who ${gone.size === 1 ? 'is' : 'are'} not in the cast.`,
            fix: 'Add the character back, or remove the relationship on the Relationships page.'
        }
    ];
}

function boardChecks(cast: CheckedCastMember[], rawBoard: unknown): CastCheck[] {
    const board = normalizeCastBoard(rawBoard);
    if (!board) return [];
    const found: CastCheck[] = [];
    const label = (index: number): string => board.sides[index].label || `Side ${index + 1}`;

    if (!board.theme) {
        found.push({
            code: 'no-theme',
            severity: 'warn',
            about: [],
            message: 'The board has no theme question yet.',
            fix: 'Write the one question the story asks, such as "Is order worth what it costs?"'
        });
    }
    const blank = board.sides.map((side, index) => (side.stance ? '' : label(index))).filter(Boolean);
    if (blank.length > 0) {
        found.push({
            code: 'blank-stance',
            severity: 'warn',
            about: blank,
            message: `${namesOf(blank)} ${blank.length === 1 ? 'does' : 'do'} not say what ${blank.length === 1 ? 'it stands' : 'they stand'} for yet.`,
            fix: 'Give each side a stance: why it fights.'
        });
    }
    for (let i = 0; i < board.sides.length; i += 1) {
        for (let j = i + 1; j < board.sides.length; j += 1) {
            const one = plain(board.sides[i].stance);
            if (one && one === plain(board.sides[j].stance)) {
                found.push({
                    code: 'duplicate-why',
                    severity: 'warn',
                    about: [label(i), label(j)],
                    message: `${label(i)} and ${label(j)} stand for the same thing.`,
                    fix: 'Give one of them a different why, or merge them.'
                });
            }
        }
    }

    const keys = new Map<string, string>();
    cast.forEach((member, index) => {
        const name = nameOf(member, index);
        if (text(member.id)) keys.set(text(member.id), name);
        if (text(member.name)) keys.set(text(member.name), name);
    });
    const gone = [...new Set(board.sides.flatMap((side) => side.members).filter((key) => !keys.has(key)))];
    if (gone.length > 0) {
        found.push({
            code: 'missing-character',
            severity: 'warn',
            about: gone,
            message: `The board places ${gone.length} ${gone.length === 1 ? 'character who is' : 'characters who are'} no longer in the cast.`,
            fix: 'Press "Clear missing" on the board, or add the character back.'
        });
    }
    const empty = board.sides
        .map((side, index) => (side.members.some((key) => keys.has(key)) ? '' : label(index)))
        .filter(Boolean);
    if (empty.length > 0) {
        found.push({
            code: 'empty-side',
            severity: 'info',
            about: empty,
            message: `No one stands for ${namesOf(empty)} yet.`,
            fix: 'Place a character on the side, or leave it as an unnamed group.'
        });
    }
    const placed = new Set(board.sides.flatMap((side) => side.members));
    const loose = cast
        .map((member, index) => ({ member, name: nameOf(member, index) }))
        .filter(({ member }) => !placed.has(text(member.id)) && !placed.has(text(member.name)) && boardKey(member))
        .map(({ name }) => name);
    if (loose.length > 0 && loose.length < cast.length) {
        found.push({
            code: 'unplaced',
            severity: 'info',
            about: loose,
            message: `${namesOf(loose)} ${loose.length === 1 ? 'is' : 'are'} on no side.`,
            fix: 'Place them, or leave them off if they take no part in the fight.'
        });
    }
    if (castGenreTemplate(board.genre)?.sharedSecret) {
        const crowded = board.sides.filter((side) => side.members.length > 1).map((side) => side.label);
        if (crowded.length > 0) {
            found.push({
                code: 'secret-differs',
                severity: 'info',
                about: crowded,
                message: `In ${namesOf(crowded)}, everyone should share the motive and hide something different.`,
                fix: 'Check that no two people there are hiding the same thing.'
            });
        }
    }
    return found;
}

/** Every finding for the story's cast, warnings before reminders. */
export function castChecks(story: CheckedStory | null | undefined): CastCheck[] {
    const cast = Array.isArray(story?.cast) ? story.cast.filter(Boolean) : [];
    if (cast.length === 0) return [];
    const found = [...webChecks(cast), ...relationshipChecks(cast, story?.relationships), ...boardChecks(cast, story?.cast_board)];
    return [...found.filter((check) => check.severity === 'warn'), ...found.filter((check) => check.severity === 'info')];
}
