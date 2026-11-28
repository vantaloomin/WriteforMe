// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterReader, characterReaderSections } from '@/components';

const KIT = {
    name: 'Kit Hardcastle',
    role: 'Protagonist',
    corner_role: 'MAIN_CHARACTER',
    summary: 'A bike courier who never asks what is in the parcel.',
    why_it_makes_sense: 'Debts get called in.',
    details: {
        history: 'Never owe anyone.',
        deep_profile: '**What do you do?**\n\n"I carry things."'
    }
};

describe('characterReaderSections', () => {
    it('lists only what the character has, in reading order', () => {
        const sections = characterReaderSections(KIT);
        expect(sections.map((s) => s.id)).toEqual(['profile', 'history', 'interview']);
        expect(sections[0].parts.map((p) => p.field)).toEqual(['summary', 'why_it_makes_sense']);
        expect(sections[2].parts[0].field).toBe('details.deep_profile');
    });

    it('is empty for a character with nothing to read', () => {
        expect(characterReaderSections({ name: 'Nobody' })).toEqual([]);
        expect(characterReaderSections(null)).toEqual([]);
    });
});

describe('CharacterReader', () => {
    let host: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
    });

    afterEach(() => {
        act(() => root.unmount());
        host.remove();
    });

    const dialog = () => document.querySelector('.character-reader') as HTMLElement;
    const tab = (name: string) =>
        Array.from(dialog().querySelectorAll('[role="tab"]')).find(
            (el) => el.textContent === name
        ) as HTMLButtonElement;

    it('opens on the asked tab and switches tabs', () => {
        act(() =>
            root.render(<CharacterReader character={KIT} section="interview" onClose={() => {}} />)
        );
        expect(tab('Interview').getAttribute('aria-selected')).toBe('true');
        expect(dialog().querySelector('[role="tabpanel"]')?.textContent).toContain(
            'I carry things.'
        );
        act(() => tab('Backstory').click());
        expect(dialog().querySelector('[role="tabpanel"]')?.textContent?.trim()).toBe(
            'Never owe anyone.'
        );
    });

    it('closes on Escape, steps with the arrow keys, and ignores keys typed in a field', () => {
        const onClose = vi.fn();
        const onStep = vi.fn();
        act(() =>
            root.render(<CharacterReader character={KIT} onClose={onClose} onStep={onStep} />)
        );
        const press = (key: string, target: EventTarget = window) =>
            act(() => {
                target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
            });
        press('ArrowRight');
        press('ArrowLeft');
        expect(onStep.mock.calls).toEqual([[1], [-1]]);
        const field = document.createElement('textarea');
        document.body.appendChild(field);
        press('Escape', field);
        expect(onClose).not.toHaveBeenCalled();
        field.remove();
        press('Escape');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('opens on the longest text when no tab is asked for', () => {
        act(() => root.render(<CharacterReader character={KIT} onClose={() => {}} />));
        expect(tab('Interview').getAttribute('aria-selected')).toBe('true');
    });

    it('leaves keys alone while something is open above it, and stops at the ends', () => {
        const onClose = vi.fn();
        const onStep = vi.fn();
        act(() =>
            root.render(
                <CharacterReader
                    character={KIT}
                    onClose={onClose}
                    onStep={onStep}
                    hasNext={false}
                />
            )
        );
        const above = document.createElement('button');
        document.body.appendChild(above);
        act(() => {
            above.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            window.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
            );
        });
        above.remove();
        expect(onClose).not.toHaveBeenCalled();
        expect(onStep).not.toHaveBeenCalled();
        expect(
            (dialog().querySelector('[aria-label="Next character"]') as HTMLButtonElement).disabled
        ).toBe(true);
    });

    it('offers to edit the field being read', () => {
        const onEdit = vi.fn();
        act(() =>
            root.render(
                <CharacterReader
                    character={KIT}
                    section="history"
                    onClose={() => {}}
                    onEdit={onEdit}
                />
            )
        );
        act(() =>
            (dialog().querySelector('[title="Edit Backstory"]') as HTMLButtonElement).click()
        );
        expect(onEdit).toHaveBeenCalledWith('details.history', 'Backstory', 'Never owe anyone.');
    });
});
