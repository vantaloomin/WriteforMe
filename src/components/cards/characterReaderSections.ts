/**
 * @module components/cards/characterReaderSections
 * What the character reader shows, in reading order. Each section is one tab; each part is one
 * field of the character, so the reader can offer to edit exactly that field.
 */

import type { CharacterCardCharacter } from './CharacterCard';

export type ReaderSectionId = 'profile' | 'history' | 'sheet' | 'interview';

export interface ReaderPart {
    /** The field path `onEdit` takes, e.g. `details.deep_profile`. */
    field: string;
    /** The field's name. Shown above the text only when a section has several parts. */
    label: string;
    text: string;
}

export interface ReaderSection {
    id: ReaderSectionId;
    title: string;
    parts: ReaderPart[];
}

export const READER_SECTION_TITLES: Record<ReaderSectionId, string> = {
    profile: 'Profile',
    history: 'Backstory',
    sheet: 'Character Sheet',
    interview: 'Interview'
};

const PROFILE_FIELDS: Array<[field: string, label: string]> = [
    ['summary', 'Summary'],
    ['why_it_makes_sense', 'Why It Makes Sense (Safety Habit)'],
    ['what_it_costs_them', 'What It Costs Them'],
    ['way_of_living', 'Way of Living (Foil Perspective)'],
    ['why_it_is_appealing', 'Why It Pulls Protagonist'],
    ['shared_outlook', 'Shared Outlook'],
    ['the_hidden_trap', 'The Hidden Trap (Stagnation)'],
    ['how_they_ended_up', 'How They Ended Up'],
    ['the_wake_up_call', 'The Wake-Up Call'],
    ['details.story_events', 'Current Status & Arc'],
    ['details.goals', 'Core Yearning & Motivation']
];

const SINGLE_FIELDS: Array<[id: ReaderSectionId, field: string]> = [
    ['history', 'details.history'],
    ['sheet', 'details.sheet'],
    ['interview', 'details.deep_profile']
];

function read(character: CharacterCardCharacter, field: string): string {
    const value = field.startsWith('details.')
        ? character.details?.[field.slice('details.'.length)]
        : (character as Record<string, unknown>)[field];
    return typeof value === 'string' ? value.trim() : '';
}

/** The sections a character has something to read in. Empty fields and sections are left out. */
export function characterReaderSections(character: CharacterCardCharacter | null): ReaderSection[] {
    if (!character) return [];
    const profile = PROFILE_FIELDS.map(([field, label]) => ({
        field,
        label,
        text: read(character, field)
    })).filter((part) => part.text);
    const sections: ReaderSection[] = [
        { id: 'profile', title: READER_SECTION_TITLES.profile, parts: profile },
        ...SINGLE_FIELDS.map(([id, field]) => ({
            id,
            title: READER_SECTION_TITLES[id],
            parts: [{ field, label: READER_SECTION_TITLES[id], text: read(character, field) }]
        }))
    ];
    return sections.filter((section) => section.parts.some((part) => part.text));
}

/** The tab Read opens on: the longest kind of text the character has, since the card shows the rest. */
export function defaultReaderSection(sections: ReaderSection[]): ReaderSectionId | undefined {
    const order: ReaderSectionId[] = ['interview', 'sheet', 'history', 'profile'];
    return order.find((id) => sections.some((section) => section.id === id));
}
