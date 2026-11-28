import { describe, expect, it } from 'vitest';
import { isShortRole, shortenCastRoles, splitCharacterRole, withShortRole } from '@/domain/cast';
import { hydrateStoredStory } from '@/domain/lifecycle';

const REST =
    'Dulcie is the sixty-eight-year-old owner of the launderette and the closest thing Kit has to a fixed point.';
const PARAGRAPH = `The Comforter and safe haven. ${REST}`;
describe('isShortRole', () => {
    it('accepts labels and rejects sentences', () => {
        expect(isShortRole('Protagonist')).toBe(true);
        expect(isShortRole('Reluctant Love Interest')).toBe(true);
        expect(isShortRole('')).toBe(true);
        expect(isShortRole('Protagonist. A courier.')).toBe(false);
        expect(isShortRole('The one who always stays behind')).toBe(false);
    });
});

describe('splitCharacterRole', () => {
    it('keeps a label as the role', () => {
        expect(splitCharacterRole(' Mentor ')).toEqual({ role: 'Mentor', summary: '' });
    });

    it('moves a paragraph to the summary and takes the role from the corner', () => {
        expect(splitCharacterRole(PARAGRAPH, 'THE_COMFORTER')).toEqual({
            role: 'Confidant',
            summary: REST
        });
    });

    it('prefers the first label the opening sentence names', () => {
        const raw =
            'The Challenger / Foil / Love Interest. Pulls the protagonist out of their shell.';
        expect(splitCharacterRole(raw, 'THE_CHALLENGER').role).toBe('Foil');
        expect(splitCharacterRole('Protagonist. A courier who never stops.').role).toBe(
            'Protagonist'
        );
    });

    it('falls back to Supporting', () => {
        const plain = 'Runs the night desk. Sees everything.';
        expect(splitCharacterRole(plain)).toEqual({ role: 'Supporting', summary: plain });
        const long =
            'She has run the night desk at the depot for eleven years and sees everything.';
        expect(splitCharacterRole(long).summary).toBe(long);
    });
});

describe('withShortRole', () => {
    it('returns the same object when the role is already short', () => {
        const member = { name: 'Kit', role: 'Protagonist' };
        expect(withShortRole(member)).toBe(member);
    });

    it('does not overwrite a summary the character already has', () => {
        const fixed = withShortRole({ role: PARAGRAPH, summary: 'Owns the launderette.' });
        expect(fixed).toEqual({ role: 'Supporting', summary: 'Owns the launderette.' });
    });
});

describe('shortenCastRoles', () => {
    it('repairs only the characters that need it', () => {
        const kit = { name: 'Kit', role: 'Protagonist' };
        const cast = [kit, { name: 'Dulcie', role: PARAGRAPH, corner_role: 'THE_COMFORTER' }];
        const fixed = shortenCastRoles(cast);
        expect(fixed[0]).toBe(kit);
        expect(fixed[1]).toMatchObject({ role: 'Confidant', summary: REST });
        expect(shortenCastRoles([kit])).toEqual([kit]);
    });

    it('runs when a saved story is opened', () => {
        const { story } = hydrateStoredStory({ cast: [{ name: 'Dulcie', role: PARAGRAPH }] }, 's1');
        expect((story.cast as Array<Record<string, string>>)[0]).toMatchObject({
            role: 'Supporting',
            summary: REST
        });
    });
});
