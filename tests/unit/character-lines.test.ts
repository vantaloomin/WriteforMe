import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    characterBrief,
    characterLinesBlock,
    cleanSpokenLine,
    parseCharacterLines,
    speakingCast,
    wantsCharacterLines
} from '@/domain/cast';
import { cacheOrderProblems, takeCachePoint } from '@/domain/prompt/cacheLayout';
import { gatherCharacterLines } from '@/pipeline/characterLines';
import type { PipelineRuntimeContext } from '@/pipeline/context';
import { buildProseContext } from '@/pipeline/proseContext';
import { ModelStopError } from '@/services/llm';
import { normalizeFeatureOptions, useFeatureOptionsStore } from '@/stores';

const cast = () => [
    { id: 'c3', name: 'Pell', role: 'Dockhand', corner_role: 'SUPPORTING' },
    {
        id: 'c2',
        name: 'Dov Hale',
        role: 'Foil',
        corner_role: 'THE_CHALLENGER',
        core_desire: 'To open the harbor.',
        core_flaw: 'Gives too much.',
        details: { deep_profile: 'I never met a locked door I liked. The ledger is forged, and I forged it.' }
    },
    {
        id: 'c1',
        name: 'Mara Vance',
        role: 'Protagonist',
        corner_role: 'MAIN_CHARACTER',
        core_desire: 'To keep the harbor.',
        core_flaw: 'Trusts no one.',
        details: { deep_profile: 'I count the boats twice.' }
    }
];

const scene = {
    title: 'The ledger',
    setting: 'The harbor office at dusk',
    entrance_conditions: 'Mara is alone with the books when Dov comes in.',
    surface_activity: 'Counting the day’s tolls',
    pov_character: 'Mara Vance',
    main_character_heart: 'She wants to be wrong about him.',
    other_character_heart: 'He wants her to stop looking.',
    scene_events: 'Mara finds the forged page and Dov confesses.',
    the_hinge_moment: 'Dov reaches for the ledger first.',
    exit_hook: 'She locks the office with him inside.'
};

describe('which scenes and who', () => {
    it('covers no scene when off, the last of a sequence for key, and every scene for all', () => {
        expect(wantsCharacterLines('off', 2, 3)).toBe(false);
        expect(wantsCharacterLines('key', 1, 3)).toBe(false);
        expect(wantsCharacterLines('key', 2, 3)).toBe(true);
        expect(wantsCharacterLines('key', 0, 0)).toBe(false);
        expect(wantsCharacterLines('all', 0, 3)).toBe(true);
    });

    it('asks the corner characters first, the main character before the rest, four at most', () => {
        expect(speakingCast(cast()).map((c) => c.name)).toEqual(['Mara Vance', 'Dov Hale', 'Pell']);
        const crowd = [...cast(), { name: 'A' }, { name: 'B' }, { name: 'C' }];
        expect(speakingCast(crowd)).toHaveLength(4);
        // Someone alone has no one to talk to.
        expect(speakingCast([cast()[2]])).toEqual([]);
        expect(speakingCast([cast()[2], null, { name: '' }])).toEqual([]);
    });
});

describe('what a character is told', () => {
    it('holds who they are and where they are, and nothing of how the scene goes', () => {
        const brief = characterBrief({
            member: cast()[2],
            voice: 'Clipped, dry.',
            scene,
            others: ['Dov Hale', 'Pell'],
            views: { 'Dov Hale': 'Old friend. She thinks he is hiding something.', Pell: '' }
        });
        expect(brief).toContain('Name: Mara Vance');
        expect(brief).toContain('What you want most: To keep the harbor.');
        expect(brief).toContain('<your_voice>\nClipped, dry.\n</your_voice>');
        expect(brief).toContain('Where: The harbor office at dusk');
        expect(brief).toContain('What is on your mind: She wants to be wrong about him.');
        expect(brief).toContain('Who is here with you: Dov Hale, Pell');
        expect(brief).toContain('Dov Hale: Old friend. She thinks he is hiding something.');
        expect(brief).not.toContain('Pell:');
        for (const planned of ['confesses', 'reaches for the ledger', 'locks the office', 'The ledger']) {
            expect(brief).not.toContain(planned);
        }
    });

    it('gives someone who is not the point of view the other heart', () => {
        const brief = characterBrief({ member: cast()[1], voice: '', scene, others: ['Mara Vance'], views: {} });
        expect(brief).toContain('What is on your mind: He wants her to stop looking.');
        expect(brief).not.toContain('<your_voice>');
        expect(brief).not.toContain('<how_you_see_them>');
    });
});

describe('reading an answer', () => {
    it('keeps spoken words only', () => {
        expect(cleanSpokenLine('Mara Vance: "Count them again." *she does not look up*', 'Mara Vance')).toBe('Count them again.');
        expect(cleanSpokenLine('(quietly) You were never late before.', 'Mara Vance')).toBe('You were never late before.');
        expect(cleanSpokenLine('*shrugs*', 'Mara Vance')).toBe('');
        expect(cleanSpokenLine('word '.repeat(100), 'Mara Vance').length).toBeLessThanOrEqual(280);
    });

    it('takes up to four different lines and what they want, and nothing from a useless answer', () => {
        const answer = `<wants>To hear him say it.</wants>
<line>Count them again.</line>
<line>count them again.</line>
<line>*sighs*</line>
<line>You were never late before.</line>
<line>Three.</line><line>Four.</line><line>Five.</line>`;
        expect(parseCharacterLines(answer, 'Mara Vance')).toEqual({
            name: 'Mara Vance',
            wants: 'To hear him say it.',
            lines: ['Count them again.', 'You were never late before.', 'Three.', 'Four.']
        });
        expect(parseCharacterLines('I would say many things.', 'Mara Vance')).toBeNull();
        expect(parseCharacterLines(null, 'Mara Vance')).toBeNull();
    });

    it('shows the writer the lines, safely', () => {
        const block = characterLinesBlock([
            { name: 'Mara "M" Vance', wants: 'Truth & quiet', lines: ['Is 3 < 4?'] },
            { name: 'Nobody', wants: '', lines: [] }
        ]);
        expect(block).toContain('<character name="Mara &quot;M&quot; Vance">');
        expect(block).toContain('<wants>Truth &amp; quiet</wants>');
        expect(block).toContain('<line>Is 3 &lt; 4?</line>');
        expect(block).not.toContain('Nobody');
        expect(block).toContain('never bend the scene');
        expect(characterLinesBlock([])).toBe('');
    });
});

describe('asking the characters', () => {
    const story = {
        id: 's1',
        cast: cast(),
        relationships: { 'Mara Vance->Dov Hale': { dynamic: 'Old friend', hidden_tension: 'She thinks he is hiding something' } },
        secret_vault: [
            {
                id: 'sec1',
                title: 'The forgery',
                truth: 'The ledger is forged, and I forged it.',
                status: 'hidden',
                reveal_anchor: { sequence_number: 5 }
            }
        ],
        sequences: [{ number: 1, title: 'One' }],
        scenes: { '0': [scene] },
        lore: []
    };
    const request = (s = 0, scenesInSequence = 1) => ({
        story: story as never,
        scene,
        seq: 0,
        s,
        scenesInSequence,
        sequenceNumber: 1,
        activeCast: cast() as never
    });
    const context = (callAI: (...args: unknown[]) => Promise<unknown>) =>
        ({ callAI, setLoadingStep: vi.fn() }) as unknown as PipelineRuntimeContext;
    const setMode = (mode: string): void => useFeatureOptionsStore.getState().setOption('characterLines', mode as never);

    beforeEach(() => setMode('key'));
    afterEach(() => setMode('off'));

    it('is off unless asked for', async () => {
        expect(normalizeFeatureOptions({}).characterLines).toBe('off');
        expect(normalizeFeatureOptions({ characterLines: 'sometimes' }).characterLines).toBe('off');
        setMode('off');
        const callAI = vi.fn();
        expect(await gatherCharacterLines(context(callAI), request())).toBe('');
        setMode('key');
        expect(await gatherCharacterLines(context(callAI), request(0, 3))).toBe('');
        expect(callAI).not.toHaveBeenCalled();
    });

    it('asks each speaker once, with their own scrubbed profile, and builds the block', async () => {
        const calls: Array<{ prompt: string; system: string; json: boolean; log: string; role: string }> = [];
        const callAI = vi.fn(async (prompt: unknown, system: unknown, json: unknown, log: unknown, role: unknown) => {
            calls.push({ prompt: String(prompt), system: String(system), json: Boolean(json), log: String(log), role: String(role) });
            const name = String(log).includes('Mara') ? 'Mara' : String(log).includes('Dov') ? 'Dov' : 'Pell';
            return `<wants>${name} wants something.</wants><line>${name} speaks.</line>`;
        });
        const block = await gatherCharacterLines(context(callAI), request());
        expect(calls.map((c) => c.log)).toEqual([
            'Character Lines: Mara Vance (Scene 1.1)',
            'Character Lines: Dov Hale (Scene 1.1)',
            'Character Lines: Pell (Scene 1.1)'
        ]);
        expect(calls.every((c) => c.role === 'prose' && c.json === false && c.system.includes('Spoken words only'))).toBe(true);
        expect(calls[0].prompt).toContain('Dov Hale: Old friend. She thinks he is hiding something');
        // The unrevealed truth is scrubbed from the profile Dov is given, so no line can tell it.
        expect(calls[1].prompt).toContain('I never met a locked door I liked.');
        expect(calls[1].prompt).not.toContain('forged');
        expect(calls[0].prompt).not.toContain('I never met a locked door');
        expect(block).toContain('<character name="Mara Vance">');
        expect(block).toContain('<line>Dov speaks.</line>');
    });

    it('carries on when one character fails, and stops when the user stops', async () => {
        const flaky = vi.fn(async (_p: unknown, _s: unknown, _j: unknown, log: unknown) => {
            if (String(log).includes('Dov')) throw new Error('timeout');
            if (String(log).includes('Pell')) return 'no tags here';
            return '<line>Count them again.</line>';
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const block = await gatherCharacterLines(context(flaky), request());
        expect(block).toContain('Mara Vance');
        expect(block).not.toContain('Dov Hale');
        expect(block).not.toContain('Pell');
        vi.restoreAllMocks();

        const stopped = vi.fn(async () => {
            throw new ModelStopError();
        });
        await expect(gatherCharacterLines(context(stopped), request())).rejects.toBeInstanceOf(ModelStopError);
        expect(stopped).toHaveBeenCalledTimes(1);
    });
});

describe('in the scene-writing prompt', () => {
    it('sits with the scene, before the cache point, and is absent by default', () => {
        const story = { id: 's1', cast: cast(), sequences: [{ number: 1 }], scenes: { '0': [scene] }, relationships: {}, lore: [] };
        const block = characterLinesBlock([{ name: 'Mara Vance', wants: '', lines: ['Count them again.'] }]);
        const withLines = buildProseContext({
            storyToUse: story as never,
            scene: scene as never,
            seq: 0,
            s: 0,
            activeCast: cast() as never,
            characterLinesBlock: block
        });
        const clean = takeCachePoint(withLines);
        expect(clean.prompt).toContain('<line>Count them again.</line>');
        expect(clean.prompt.indexOf('<character_lines>')).toBeGreaterThan(clean.prompt.indexOf('<scene_blueprint>'));
        if (clean.cacheSplitIndex !== null) {
            expect(clean.prompt.indexOf('<character_lines>')).toBeLessThan(clean.cacheSplitIndex);
        }
        expect(cacheOrderProblems(clean.prompt)).toEqual([]);
        const without = buildProseContext({ storyToUse: story as never, scene: scene as never, seq: 0, s: 0, activeCast: cast() as never });
        expect(without).not.toContain('<character_lines>');
    });
});
