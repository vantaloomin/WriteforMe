// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineChoiceField } from '@/components/common';
import { CORNER_ROLE_OPTIONS, cornerRoleLabel, STORY_ROLE_PRESETS } from '@/config';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('InlineChoiceField', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    const open = () => act(() => container.querySelector('button')?.click());
    const type = (text: string) => {
        const input = container.querySelector('input') as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        act(() => {
            setter?.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        return input;
    };
    const press = (el: Element, key: string) =>
        act(() => {
            el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        });
    const options = () => [...container.querySelectorAll('[role="option"]')].map((o) => o.textContent);

    it('edits in place: shows the presets, and saves a picked one', () => {
        const onCommit = vi.fn();
        act(() =>
            root.render(
                <InlineChoiceField
                    label="Role"
                    value="Student"
                    options={STORY_ROLE_PRESETS}
                    onCommit={onCommit}
                />
            )
        );
        expect(container.querySelector('[role="listbox"]')).toBeNull();
        open();
        expect(options()).toContain('Love Interest');
        const pick = [...container.querySelectorAll('[role="option"]')].find(
            (o) => o.textContent === 'Antagonist'
        ) as Element;
        act(() => {
            pick.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        });
        expect(onCommit).toHaveBeenCalledWith('Antagonist');
        expect(container.querySelector('input')).toBeNull();
    });

    it('accepts free text on Enter and narrows the list while typing', () => {
        const onCommit = vi.fn();
        act(() =>
            root.render(
                <InlineChoiceField
                    label="Role"
                    value="Student"
                    options={STORY_ROLE_PRESETS}
                    onCommit={onCommit}
                />
            )
        );
        open();
        const input = type('  Harbour Clerk ');
        expect(options()).toEqual([]);
        type('ma');
        expect(options()).toEqual(['Ensemble Main']);
        type('Harbour Clerk ');
        press(input, 'Enter');
        expect(onCommit).toHaveBeenCalledWith('Harbour Clerk');
    });

    it('cancels on Escape and does not save an unchanged or empty value', () => {
        const onCommit = vi.fn();
        act(() => root.render(<InlineChoiceField label="Name" value="Maren" onCommit={onCommit} />));
        open();
        press(type('Someone Else'), 'Escape');
        open();
        press(type('   '), 'Enter');
        open();
        press(type('Maren'), 'Enter');
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('saves what was typed when the writer clicks away', () => {
        const onCommit = vi.fn();
        act(() => root.render(<InlineChoiceField label="Name" value="Maren" onCommit={onCommit} />));
        open();
        type('Maren Vance');
        act(() => {
            document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        });
        expect(onCommit).toHaveBeenCalledWith('Maren Vance');
    });

    it('offers only the listed values when custom text is not allowed', () => {
        const onCommit = vi.fn();
        act(() =>
            root.render(
                <InlineChoiceField
                    label="Four-Corner role"
                    value="SUPPORTING"
                    options={CORNER_ROLE_OPTIONS}
                    allowCustom={false}
                    onCommit={onCommit}
                />
            )
        );
        expect(container.textContent).toBe('Supporting');
        open();
        expect(container.querySelector('input')).toBeNull();
        const trigger = container.querySelector('[role="combobox"]') as Element;
        press(trigger, 'ArrowDown');
        press(trigger, 'Enter');
        expect(onCommit).toHaveBeenCalledWith('MAIN_CHARACTER');
    });

    it('labels stored corner roles, and shows an unknown one as written', () => {
        expect(cornerRoleLabel('THE_WARNING')).toBe('The Warning');
        expect(cornerRoleLabel('RIVAL_MENTOR')).toBe('RIVAL MENTOR');
        expect(cornerRoleLabel(undefined)).toBe('');
    });
});

describe('InlineChoiceField allowEmpty', () => {
    it('lets a clearable field be saved empty', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const onCommit = vi.fn();
        act(() =>
            root.render(
                <InlineChoiceField label="POV character" value="Maren" allowEmpty onCommit={onCommit} />
            )
        );
        act(() => container.querySelector('button')?.click());
        const input = container.querySelector('input') as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        act(() => {
            setter?.call(input, '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        act(() => {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        expect(onCommit).toHaveBeenCalledWith('');
        act(() => root.unmount());
        container.remove();
    });
});
