/**
 * @module config/cast
 * The short, repeatable words on a character card: story roles and Four-Corner roles.
 */

export interface ChoiceOption {
    value: string;
    label: string;
}

/** Suggested story roles. A role is free text: these keep a cast consistent, they do not limit it. */
export const STORY_ROLE_PRESETS: ChoiceOption[] = [
    'Protagonist',
    'Ensemble Main',
    'Antagonist',
    'Love Interest',
    'Mentor',
    'Foil',
    'Confidant',
    'Supporting',
    'Side',
    'Minor'
].map((role) => ({ value: role, label: role }));

/** The Four-Corner roles. The pipeline reads these exact values, so this list is closed. */
export const CORNER_ROLE_OPTIONS: ChoiceOption[] = [
    { value: 'MAIN_CHARACTER', label: 'Main Character' },
    { value: 'THE_CHALLENGER', label: 'The Challenger' },
    { value: 'THE_COMFORTER', label: 'The Comforter' },
    { value: 'THE_WARNING', label: 'The Warning' },
    { value: 'SUPPORTING', label: 'Supporting' }
];

/** The label for a stored corner role; an unknown value is shown as written. */
export function cornerRoleLabel(value: string | null | undefined): string {
    if (!value) return '';
    return (
        CORNER_ROLE_OPTIONS.find((option) => option.value === value)?.label ||
        value.replace(/_/g, ' ')
    );
}

/** The story role a new character gets from their corner when none is typed. */
export const CORNER_DEFAULT_STORY_ROLE: Record<string, string> = {
    MAIN_CHARACTER: 'Protagonist',
    THE_CHALLENGER: 'Foil',
    THE_COMFORTER: 'Confidant',
    THE_WARNING: 'Opponent',
    SUPPORTING: 'Supporting'
};
