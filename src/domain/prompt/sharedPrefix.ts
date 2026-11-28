/**
 * @module domain/prompt/sharedPrefix
 * Finds the cache point for prompts whose builder did not mark one. A step that runs again
 * within a few minutes (a retry with a note added at the end, a second pass, the next item of
 * a loop) usually starts with the same text as last time. This remembers each step's last
 * prompt, and from the second call on reports where the shared start ends, so the dispatcher
 * can ask the provider to cache it: written on the second call, read back from the third.
 *
 * Nothing is marked on a step's first call, so a prompt that is sent once never pays the
 * provider's extra charge for writing a cache entry.
 */

/** A shared start shorter than this (about a thousand tokens) is not worth a cache entry. */
export const SHARED_PREFIX_MIN_CHARS = 4000;
/** Providers drop a cached start that has not been read for five minutes. */
export const SHARED_PREFIX_WINDOW_MS = 5 * 60 * 1000;
const REMEMBERED_STEPS = 64;

interface Remembered {
    prompt: string;
    split: number | null;
    at: number;
}

const remembered = new Map<string, Remembered>();

/** How many characters two strings share from their start. */
export function commonPrefixLength(a: string, b: string): number {
    const limit = Math.min(a.length, b.length);
    let i = 0;
    while (i < limit && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    return i;
}

/**
 * Where this prompt's shared start ends, in characters, or null when the step has not run in
 * the last five minutes or shares too little with its last prompt. The point sits just after a
 * line break, so the prompt is never cut inside a word or a tag. A point that still fits is
 * reused exactly, because a provider only reads back a start that ends in the same place.
 */
export function sharedPrefixSplit(stepKey: string, prompt: string, now: number = Date.now()): number | null {
    const previous = remembered.get(stepKey);
    let split: number | null = null;

    if (previous && now - previous.at <= SHARED_PREFIX_WINDOW_MS) {
        if (
            previous.split !== null &&
            prompt.length > previous.split &&
            commonPrefixLength(previous.prompt, prompt) >= previous.split
        ) {
            split = previous.split;
        } else {
            const shared = commonPrefixLength(previous.prompt, prompt);
            const lineEnd = prompt.lastIndexOf('\n', shared - 1) + 1;
            if (lineEnd >= SHARED_PREFIX_MIN_CHARS && lineEnd < prompt.length) split = lineEnd;
        }
    }

    remembered.delete(stepKey);
    remembered.set(stepKey, { prompt, split, at: now });
    if (remembered.size > REMEMBERED_STEPS) {
        const oldest = remembered.keys().next().value;
        if (oldest !== undefined) remembered.delete(oldest);
    }
    return split;
}

export function forgetSharedPrefixes(): void {
    remembered.clear();
}
