import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SLOP_CONFIG,
    detectDialogueEchoes,
    detectDialoguePingPong,
    dialogueShapeAdvisories,
    scanTextForSlop
} from '@/domain/slop';
import { validateStructuralOutput } from '@/domain/validation/structuralValidator';

const VOLLEY = [
    'Marta set the crate on the dock and wiped her hands on her coat.',
    '"Is that all of it?"',
    '"All I could carry."',
    '"There were nine."',
    '"There are seven now."',
    '"Who took two?" Dov asked.',
    '"Nobody took them."',
    '"Then where did they go?"',
    'The tide slapped the pilings under them, and neither of them looked down.'
].join('\n\n');

const BROKEN_VOLLEY = [
    '"Is that all of it?"',
    '"All I could carry."',
    '"There were nine."',
    'Marta counted them again with her thumb, lid by lid, the way her mother had counted hens at dusk.',
    '"There are seven now."',
    '"Who took two?" Dov asked.',
    '"Nobody took them."'
].join('\n\n');

const ECHOES = [
    '"You can row and bail at once," Dov said.',
    '"I can row and bail and still hear you sulk."',
    'She shipped the oars. Water ran off the blades and ticked against the hull.',
    '"Where does a tide like this go?"',
    '"Where does any of it go? Out."',
    '"Like a drain?" He leaned over the gunwale.',
    '"Like a door somebody forgot to shut."',
    '"Then shut it."'
].join('\n\n');

const PLAIN = [
    '"You can row and bail at once," Dov said.',
    '"Watch me do neither."',
    'She shipped the oars. Water ran off the blades and ticked against the hull.',
    '"Where does a tide like this go?"',
    '"Out. Past the bar, if the wind lets it."',
    '"I know what you meant," he said.',
    '"I know you do."'
].join('\n\n');

describe('dialogue ping-pong', () => {
    it('finds a volley of short spoken paragraphs and counts the bare ones', () => {
        const runs = detectDialoguePingPong(VOLLEY);
        expect(runs).toHaveLength(1);
        expect(runs[0].turns).toBe(7);
        expect(runs[0].bareTurns).toBe(6);
        expect(VOLLEY.slice(runs[0].start, runs[0].end).startsWith('"Is that all of it?"')).toBe(true);
    });

    it('lets a paragraph of narration end the run', () => {
        expect(detectDialoguePingPong(BROKEN_VOLLEY)).toHaveLength(0);
    });

    it('does not count a long speech as a short turn', () => {
        const speech = `"${'the harbour master said the ledger was wrong and he would not sign it '.repeat(4)}"`;
        const text = VOLLEY.replace('"There were nine."', speech);
        expect(detectDialoguePingPong(text)).toHaveLength(0);
    });

    it('reads curly quotes the same way', () => {
        const curly = VOLLEY.replace(/"([^"]*)"/g, '“$1”');
        expect(detectDialoguePingPong(curly)[0].turns).toBe(7);
    });
});

describe('dialogue echoing', () => {
    it('finds a reused phrase and a reused opening', () => {
        const echoes = detectDialogueEchoes(ECHOES);
        expect(echoes.map((e) => e.phrase)).toEqual(['can row and bail', 'where does', 'like a']);
        expect(echoes.map((e) => e.kind)).toEqual(['phrase', 'opening', 'opening']);
        expect(ECHOES.slice(echoes[0].start).startsWith('I can row and bail')).toBe(true);
    });

    it('matches the opening against any sentence of the line before', () => {
        const text = ['"Under the pier?" He frowned. "Like a drain?"', '"Like a door somebody forgot to shut."'].join('\n\n');
        expect(detectDialogueEchoes(text).map((e) => e.phrase)).toEqual(['like a']);
    });

    it('ignores replies in the speaker own words and pronoun openings', () => {
        expect(detectDialogueEchoes(PLAIN)).toHaveLength(0);
    });

    it('does not pair lines separated by more than one paragraph of narration', () => {
        const apart = [
            '"You can row and bail at once."',
            'She shipped the oars.',
            'Water ran off the blades.',
            '"I can row and bail and still hear you sulk."'
        ].join('\n\n');
        expect(detectDialogueEchoes(apart)).toHaveLength(0);
    });

    it('skips a shared run made only of ignored names', () => {
        const names = ['"Ask Mary Ann Vale about it."', '"Mary Ann Vale left."'].join('\n\n');
        expect(detectDialogueEchoes(names, { ignoreWords: new Set(['mary', 'ann', 'vale']) })).toHaveLength(0);
        expect(detectDialogueEchoes(names)).toHaveLength(1);
    });
});

describe('slop audit dialogue rules', () => {
    const ids = (text: string, options = {}) =>
        scanTextForSlop(text, options).densityHits.map((h) => h.categoryId);

    it('flags a volley and needs three echoes before it flags echoing', () => {
        expect(ids(VOLLEY)).toContain('dialogue_ping_pong');
        expect(ids(ECHOES).filter((id) => id === 'dialogue_echo')).toHaveLength(3);
        const twoEchoes = ECHOES.split('\n\n').slice(0, 5).join('\n\n');
        expect(ids(twoEchoes)).not.toContain('dialogue_echo');
    });

    it('stays quiet in audio drama and when a rule is switched off', () => {
        expect(ids(VOLLEY, { isAudioDrama: true })).not.toContain('dialogue_ping_pong');
        expect(ids(ECHOES, { isAudioDrama: true })).not.toContain('dialogue_echo');
        const off = {
            ...DEFAULT_SLOP_CONFIG,
            categorySeverities: { ...DEFAULT_SLOP_CONFIG.categorySeverities, dialogue_ping_pong: 'off', dialogue_echo: 'off' }
        };
        expect(ids(VOLLEY, { slopConfig: off })).not.toContain('dialogue_ping_pong');
        expect(ids(ECHOES, { slopConfig: off })).not.toContain('dialogue_echo');
    });

    it('words one advisory per habit', () => {
        const advisories = dialogueShapeAdvisories([
            ...scanTextForSlop(VOLLEY).densityHits,
            ...scanTextForSlop(ECHOES).densityHits
        ]);
        expect(advisories).toHaveLength(2);
        expect(advisories[0]).toContain('7 short spoken lines in a row, 6 with no tag or beat');
        expect(advisories[1]).toContain('3 replies reuse the previous speaker\'s words ("can row and bail", "where does", "like a")');
    });

    it('hands both habits to the reviewer as validator warnings', () => {
        const filler = ' The harbour kept its own counsel while gulls worked the tideline for scraps.'.repeat(12);
        const result = validateStructuralOutput('Writing Agent', { prose: `${VOLLEY}\n\n${ECHOES}\n\n${filler}` }, {});
        expect(result.warnings.some((w) => w.startsWith('Writing Agent: Dialogue ping-pong:'))).toBe(true);
        expect(result.warnings.some((w) => w.startsWith('Writing Agent: Dialogue echoing:'))).toBe(true);
    });
});
