import { beforeEach, describe, expect, it } from 'vitest';
import {
    commonPrefixLength,
    forgetSharedPrefixes,
    SHARED_PREFIX_MIN_CHARS,
    SHARED_PREFIX_WINDOW_MS,
    sharedPrefixSplit
} from '@/domain/prompt/sharedPrefix';

const shared = `${'The world bible says a great deal about the harbour.\n'.repeat(200)}`;
const T0 = 1_000_000;

beforeEach(() => forgetSharedPrefixes());

describe('sharedPrefixSplit', () => {
    it('counts the characters two prompts share from the start', () => {
        expect(commonPrefixLength('abcdef', 'abcxyz')).toBe(3);
        expect(commonPrefixLength('abc', 'abcdef')).toBe(3);
        expect(commonPrefixLength('', 'abc')).toBe(0);
    });

    it('marks nothing on a first call, then the shared start, then reuses the same point', () => {
        expect(shared.length).toBeGreaterThan(SHARED_PREFIX_MIN_CHARS);
        expect(sharedPrefixSplit('step', `${shared}Plan sequence 1.`, T0)).toBeNull();
        const second = sharedPrefixSplit('step', `${shared}Plan sequence 2.`, T0 + 1000);
        expect(second).toBe(shared.length);
        // A third prompt that shares even more still reads back the same start.
        expect(sharedPrefixSplit('step', `${shared}Plan sequence 22.`, T0 + 2000)).toBe(shared.length);
    });

    it('ends the shared start at a line break, never inside a line', () => {
        sharedPrefixSplit('step', `${shared}<scene number="1">alpha</scene>`, T0);
        const split = sharedPrefixSplit('step', `${shared}<scene number="2">beta</scene>`, T0 + 1);
        expect(split).toBe(shared.length);
    });

    it('covers a retry that adds a note to the end of the same prompt', () => {
        const first = `${shared}Plan the scenes.\n`;
        sharedPrefixSplit('step', first, T0);
        expect(sharedPrefixSplit('step', `${first}RETRY: you returned too few scenes.`, T0 + 1)).toBe(first.length);
    });

    it('marks nothing when the start changes, the shared part is short, or the step went quiet', () => {
        sharedPrefixSplit('a', `Section 1\n${shared}`, T0);
        expect(sharedPrefixSplit('a', `Section 2\n${shared}`, T0 + 1)).toBeNull();

        sharedPrefixSplit('b', 'short shared\nfirst', T0);
        expect(sharedPrefixSplit('b', 'short shared\nsecond', T0 + 1)).toBeNull();

        sharedPrefixSplit('c', `${shared}one`, T0);
        expect(sharedPrefixSplit('c', `${shared}two`, T0 + SHARED_PREFIX_WINDOW_MS + 1)).toBeNull();
    });

    it('keeps steps apart and finds a new point when the old one stops fitting', () => {
        sharedPrefixSplit('planner', `${shared}one`, T0);
        expect(sharedPrefixSplit('review', `${shared}two`, T0 + 1)).toBeNull();

        expect(sharedPrefixSplit('planner', `${shared}two`, T0 + 2)).toBe(shared.length);
        const half = shared.slice(0, shared.length / 2);
        expect(sharedPrefixSplit('planner', `${half}A different second half.\n${'x'.repeat(50)}`, T0 + 3)).toBe(
            half.length
        );
    });

    it('marks nothing when the whole prompt is the shared part', () => {
        sharedPrefixSplit('step', shared, T0);
        expect(sharedPrefixSplit('step', shared, T0 + 1)).toBeNull();
    });
});
