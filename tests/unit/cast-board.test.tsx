import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
    CAST_GENRE_TEMPLATES,
    boardFromTemplate,
    castChecks,
    normalizeCastBoard,
    placeOnSide,
    sideLine,
    sideOfMember,
    type CastBoard
} from '@/domain/cast';
import { cacheOrderProblems } from '@/domain/prompt/cacheLayout';
import { buildProseContext } from '@/pipeline/proseContext';
import { CastBoardPanel, type CastBoardStory } from '@/views/cast/CastBoardPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type TestMember = Record<string, string>;

const web = (): TestMember[] => [
    {
        id: 'c1',
        name: 'Mara Vance',
        corner_role: 'MAIN_CHARACTER',
        core_flaw: 'Trusts no one.',
        core_desire: 'To keep the harbor.',
        why_it_makes_sense: 'She was sold out once.',
        what_it_costs_them: 'Every ally.'
    },
    {
        id: 'c2',
        name: 'Dov Hale',
        corner_role: 'THE_CHALLENGER',
        core_flaw: 'Gives too much.',
        core_desire: 'To open the harbor.',
        way_of_living: 'Shares everything.',
        why_it_is_appealing: 'People love him.'
    },
    {
        id: 'c3',
        name: 'Ilse Varga',
        corner_role: 'THE_COMFORTER',
        core_flaw: 'Hides.',
        core_desire: 'To be left alone.',
        shared_outlook: 'Trust is for fools.',
        the_hidden_trap: 'Nothing ever changes.'
    },
    {
        id: 'c4',
        name: 'Old Brann',
        corner_role: 'THE_WARNING',
        core_flaw: 'Bitter.',
        core_desire: 'To be right.',
        how_they_ended_up: 'Alone on the pier.',
        the_wake_up_call: 'His empty house.'
    }
];

const codes = (story: Parameters<typeof castChecks>[0], severity = 'warn'): string[] =>
    castChecks(story)
        .filter((c) => c.severity === severity)
        .map((c) => c.code);

describe('templates', () => {
    it('has seventeen genres of four named sides each', () => {
        expect(CAST_GENRE_TEMPLATES).toHaveLength(17);
        for (const template of CAST_GENRE_TEMPLATES) {
            expect(template.sides).toHaveLength(4);
            expect(template.sides.every((side) => side.label && side.hint)).toBe(true);
        }
        expect(new Set(CAST_GENRE_TEMPLATES.map((t) => t.id)).size).toBe(17);
    });

    it('lays a board out, and keeps stances and people when the template changes', () => {
        const heist = boardFromTemplate('heist') as CastBoard;
        expect(heist.sides.map((s) => s.label)).toEqual(['The crew', 'The mark', 'The law', 'The rival outfit']);
        const filled: CastBoard = {
            ...heist,
            theme: 'Is loyalty a debt?',
            sides: heist.sides.map((s, i) => (i === 0 ? { ...s, stance: 'One last job.', members: ['c1'] } : s))
        };
        const western = boardFromTemplate('western', filled) as CastBoard;
        expect(western.theme).toBe('Is loyalty a debt?');
        expect(western.sides[0]).toEqual({ label: 'The town', stance: 'One last job.', members: ['c1'] });
        expect(boardFromTemplate('no-such-genre')).toBeNull();
    });

    it('keeps a character on one side at a time', () => {
        let board = boardFromTemplate('heist') as CastBoard;
        board = placeOnSide(board, 'c1', 0);
        board = placeOnSide(board, 'c1', 2);
        expect(board.sides.map((s) => s.members)).toEqual([[], [], ['c1'], []]);
        expect(placeOnSide(board, 'c1', -1).sides.every((s) => s.members.length === 0)).toBe(true);
    });

    it('cleans a stored board and refuses what is not one', () => {
        expect(normalizeCastBoard(null)).toBeNull();
        expect(normalizeCastBoard({ sides: 'x' })).toBeNull();
        const board = normalizeCastBoard({
            genre: 'made-up',
            theme: 7,
            sides: [{ label: ' A ', stance: 'x'.repeat(500), members: ['c1', 'c1', 3, ''] }, null, {}, {}, {}, {}]
        });
        expect(board?.genre).toBe('');
        expect(board?.theme).toBe('');
        expect(board?.sides).toHaveLength(4);
        expect(board?.sides[0].label).toBe('A');
        expect(board?.sides[0].stance).toHaveLength(200);
        expect(board?.sides[0].members).toEqual(['c1']);
    });

    it('finds the side a character stands with, by id or by name', () => {
        const board = placeOnSide(placeOnSide(boardFromTemplate('heist') as CastBoard, 'c1', 1), 'Dov Hale', 2);
        board.sides[1].stance = 'Keep what is theirs.';
        expect(sideLine(sideOfMember(board, { id: 'c1', name: 'Mara Vance' }))).toBe('The mark: Keep what is theirs.');
        expect(sideLine(sideOfMember(board, { name: 'Dov Hale' }))).toBe('The law');
        expect(sideLine(sideOfMember(board, { id: 'c9', name: 'Nobody' }))).toBe('');
    });
});

describe('web checks', () => {
    it('has no warnings for a complete web, only the three reminders', () => {
        expect(codes({ cast: web() })).toEqual([]);
        expect(codes({ cast: web() }, 'info')).toEqual(['corner-reminder', 'corner-reminder', 'corner-reminder']);
        expect(castChecks({ cast: [] })).toEqual([]);
        expect(castChecks(null)).toEqual([]);
    });

    it('names a missing corner and a corner with empty fields', () => {
        const cast = web().filter((c) => c.corner_role !== 'THE_WARNING');
        cast[1] = { ...cast[1], why_it_is_appealing: '' };
        const found = castChecks({ cast }).filter((c) => c.severity === 'warn');
        expect(found.map((c) => c.code)).toEqual(['role-fields', 'missing-corner']);
        expect(found[0].message).toBe('Dov Hale (Challenger) has nothing yet for why it is appealing.');
        expect(found[1].message).toBe('The web has no Warning yet.');
    });

    it('flags two main characters, a shared desire, starting text, a double name and a crowd', () => {
        const cast = web();
        cast[1] = { ...cast[1], corner_role: 'MAIN_CHARACTER', why_it_makes_sense: 'x', what_it_costs_them: 'y', core_desire: 'to keep the harbor' };
        cast[2] = { ...cast[2], core_flaw: 'Defending their current comfort zone or safety habit.' };
        cast.push({ ...web()[3], id: 'c5', corner_role: 'SUPPORTING' });
        const found = castChecks({ cast });
        const byCode = (code: string) => found.find((c) => c.code === code);
        expect(byCode('two-mains')?.about).toEqual(['Mara Vance', 'Dov Hale']);
        expect(byCode('duplicate-why')?.message).toBe('Mara Vance and Dov Hale want the same thing, in the same words.');
        expect(byCode('blank-drive')?.about).toEqual(['Ilse Varga']);
        expect(byCode('same-name')?.about).toEqual(['Old Brann']);
        expect(byCode('cast-bloat')).toBeUndefined();
        const crowd = [...web(), ...Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, name: `Extra ${i}`, corner_role: 'SUPPORTING' }))];
        expect(castChecks({ cast: crowd }).find((c) => c.code === 'cast-bloat')?.message).toContain('13 characters');
    });

    it('flags a relationship with someone who left the cast, but not a first name', () => {
        const relationships = { 'Mara->Dov Hale': {}, 'c3->c1': {}, 'Mara Vance->Tomas Reed': {} };
        const found = castChecks({ cast: web(), relationships }).find((c) => c.code === 'missing-character');
        expect(found?.about).toEqual(['Tomas Reed']);
        expect(found?.message).toBe('Relationships name Tomas Reed, who is not in the cast.');
    });
});

describe('board checks', () => {
    it('asks for a theme, stances and people, and notes who is on no side', () => {
        const board = placeOnSide(boardFromTemplate('mystery') as CastBoard, 'c1', 0);
        const found = castChecks({ cast: web(), cast_board: board });
        const byCode = (code: string) => found.find((c) => c.code === code);
        expect(byCode('no-theme')).toBeDefined();
        expect(byCode('blank-stance')?.about).toHaveLength(4);
        expect(byCode('empty-side')?.message).toBe("No one stands for The killer, The police and The victim's circle yet.");
        expect(byCode('unplaced')?.about).toEqual(['Dov Hale', 'Ilse Varga', 'Old Brann']);
        expect(byCode('secret-differs')).toBeUndefined();
    });

    it('flags two sides with the same why, a placed character who is gone, and the shared-secret reminder', () => {
        let board = boardFromTemplate('mystery') as CastBoard;
        board = { ...board, theme: 'Who pays for the truth?' };
        board.sides = board.sides.map((s, i) => ({ ...s, stance: i < 2 ? (i === 0 ? 'Order, above all.' : 'order above all') : `Why ${i}` }));
        board = placeOnSide(placeOnSide(placeOnSide(board, 'c1', 3), 'c2', 3), 'gone-id', 1);
        const found = castChecks({ cast: web(), cast_board: board });
        const byCode = (code: string) => found.find((c) => c.code === code);
        expect(byCode('no-theme')).toBeUndefined();
        expect(byCode('blank-stance')).toBeUndefined();
        expect(found.filter((c) => c.code === 'duplicate-why')[0].message).toBe('The detective and The killer stand for the same thing.');
        expect(byCode('missing-character')?.message).toContain('1 character who is no longer in the cast');
        expect(byCode('secret-differs')?.about).toEqual(["The victim's circle"]);
        // Warnings come before reminders.
        const severities = found.map((c) => c.severity);
        expect(severities.lastIndexOf('warn')).toBeLessThan(severities.indexOf('info'));
    });
});

describe('in the scene-writing prompt', () => {
    const story = (board: unknown) => ({
        id: 's1',
        cast: web(),
        cast_board: board,
        sequences: [{ number: 1, title: 'One' }],
        scenes: { '0': [{ number: '1.1', title: 'Pier', objective: 'Meet.' }] },
        relationships: {},
        lore: []
    });

    it('tells the writer which side a character stands with, only when there is a board', () => {
        const board = placeOnSide(boardFromTemplate('heist') as CastBoard, 'c1', 0);
        board.sides[0].stance = 'One last job, then out.';
        const withBoard = buildProseContext({ storyToUse: story(board) as never, seq: 0, s: 0, activeCast: web() as never });
        expect(withBoard).toContain('<stands_with>The crew: One last job, then out.</stands_with>');
        expect(withBoard.match(/<stands_with>/g)).toHaveLength(1);
        expect(cacheOrderProblems(withBoard)).toEqual([]);
        const without = buildProseContext({ storyToUse: story(undefined) as never, seq: 0, s: 0, activeCast: web() as never });
        expect(without).not.toContain('<stands_with>');
    });
});

describe('the board panel', () => {
    const roots: Root[] = [];
    afterEach(() => {
        while (roots.length) {
            const root = roots.pop();
            act(() => root?.unmount());
        }
        document.body.innerHTML = '';
    });

    it('shows the checks, lays out a template, and places a character', () => {
        const box: { story: CastBoardStory } = { story: { cast: web().slice(0, 3), relationships: {} } };
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        roots.push(root);
        const render = (): void =>
            act(() =>
                root.render(
                    <CastBoardPanel
                        story={box.story}
                        setStory={(updater) => {
                            box.story = updater(box.story);
                            render();
                        }}
                    />
                )
            );
        render();
        expect(host.querySelector('[data-testid="cast-check-count"]')?.textContent).toBe('1 warning');
        expect(host.textContent).toContain('The web has no Warning yet.');
        expect(host.querySelector('[data-testid="cast-side-0"]')).toBeNull();

        const select = host.querySelector('select')!;
        act(() => {
            select.value = 'heist';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect((box.story.cast_board as CastBoard).genre).toBe('heist');
        expect(host.querySelectorAll('[data-testid^="cast-side-"]')).toHaveLength(4);
        expect(host.textContent).toContain('The board has no theme question yet.');

        const side = host.querySelector('[data-testid="cast-side-1"]')!;
        const chip = [...side.querySelectorAll('button')].find((b) => b.textContent === 'Dov Hale')!;
        act(() => chip.click());
        expect((box.story.cast_board as CastBoard).sides[1].members).toEqual(['c2']);
        expect(host.querySelector('[data-testid="cast-side-1"] button[aria-pressed="true"]')?.textContent).toBe('Dov Hale');

        act(() => {
            select.value = '';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect('cast_board' in box.story).toBe(false);
    });
});
