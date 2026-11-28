/**
 * Two dialogue habits a phrase list cannot see, both read from paragraph shape.
 *
 * Ping-pong: a long volley of short paragraphs that each open on a spoken line,
 * with no paragraph of action, interiority or description breaking it.
 *
 * Echoing: a reply built from the previous speaker's words ("You can sew and
 * chew." / "I can sew and chew and judge you."). One is craft, a scene full of
 * them is a tic, so the caller decides how many it takes to flag.
 *
 * Prose only. Audio drama scripts are all turns by design, and they ask for
 * echoes on purpose so a listener keeps hold of plot facts.
 */
import { STOP_WORDS_SLOP } from './registry';

export interface DialogueParagraph {
    start: number;
    end: number;
    /** Words in the whole paragraph. */
    words: number;
    /** Words inside quotation marks, lower-cased, punctuation stripped. */
    spoken: string[];
    /** Index in `spoken` where each spoken sentence begins. */
    sentenceStarts: number[];
    /** Offset of the first spoken word, for pointing a hit at the line. */
    spokenStart: number;
    /** Words outside quotation marks: the tag or beat. */
    narrationWords: number;
    opensWithQuote: boolean;
}

export interface PingPongRun {
    start: number;
    end: number;
    /** Paragraphs in the run. */
    turns: number;
    /** Turns with no tag and no beat at all. */
    bareTurns: number;
}

export interface DialogueEcho {
    start: number;
    end: number;
    /** The words the reply took from the line before. */
    phrase: string;
    kind: 'phrase' | 'opening';
}

const OPEN_QUOTES = '"“';
const QUOTE_RX = /["“]([^"“”]*)["”]?/g;
const WORD_RX = /[A-Za-z0-9][A-Za-z0-9'’-]*/g;

/** Replies that open on a subject pronoun share their first two words too often to mean anything. */
const OPENING_IGNORED_FIRST_WORDS = new Set([
    'i', 'you', 'he', 'she', 'we', 'they', 'it', "i'm", "it's", "you're", "we're", "they're", "he's", "she's",
    'the', 'a', 'an', 'and', 'but', 'so', 'well', 'oh', 'no', 'yes', 'yeah', 'okay', 'ok'
]);

function normalizeWord(word: string): string {
    return word.toLowerCase().replace(/’/g, "'");
}

function countWords(text: string): number {
    return (text.match(WORD_RX) || []).length;
}

export function splitDialogueParagraphs(text: string): DialogueParagraph[] {
    const raw = String(text || '');
    const paragraphs: DialogueParagraph[] = [];
    const lineRx = /[^\n]+/g;
    let line: RegExpExecArray | null;
    while ((line = lineRx.exec(raw)) !== null) {
        const body = line[0];
        const trimmed = body.trim();
        if (!trimmed) continue;
        const start = line.index + (body.length - body.trimStart().length);
        const spoken: string[] = [];
        const sentenceStarts: number[] = [];
        let spokenStart = start;
        let spokenWordCount = 0;
        QUOTE_RX.lastIndex = 0;
        let quote: RegExpExecArray | null;
        while ((quote = QUOTE_RX.exec(trimmed)) !== null) {
            const inner = quote[1];
            const words = inner.match(WORD_RX) || [];
            if (words.length > 0 && spoken.length === 0) {
                spokenStart = start + quote.index + 1 + inner.search(/[A-Za-z0-9]/);
            }
            inner.split(/[.!?\u2026]+/).forEach((sentence) => {
                const sentenceWords = sentence.match(WORD_RX) || [];
                if (sentenceWords.length === 0) return;
                sentenceStarts.push(spoken.length);
                sentenceWords.forEach((w) => spoken.push(normalizeWord(w)));
            });
            spokenWordCount += words.length;
            if (quote[0].length === 0) QUOTE_RX.lastIndex++;
        }
        const words = countWords(trimmed);
        paragraphs.push({
            start,
            end: start + trimmed.length,
            words,
            spoken,
            sentenceStarts,
            spokenStart,
            narrationWords: Math.max(0, words - spokenWordCount),
            opensWithQuote: OPEN_QUOTES.includes(trimmed[0])
        });
    }
    return paragraphs;
}

export function detectDialoguePingPong(
    text: string,
    options?: { minTurns?: number; maxWords?: number }
): PingPongRun[] {
    const minTurns = Math.max(2, options?.minTurns || 6);
    const maxWords = Math.max(1, options?.maxWords || 30);
    const paragraphs = splitDialogueParagraphs(text);
    const runs: PingPongRun[] = [];
    let run: DialogueParagraph[] = [];

    const close = () => {
        if (run.length >= minTurns) {
            runs.push({
                start: run[0].start,
                end: run[run.length - 1].end,
                turns: run.length,
                bareTurns: run.filter((p) => p.narrationWords === 0).length
            });
        }
        run = [];
    };

    paragraphs.forEach((p) => {
        if (p.opensWithQuote && p.spoken.length > 0 && p.words <= maxWords) run.push(p);
        else close();
    });
    close();
    return runs;
}

function longestSharedRun(prev: string[], next: string[]): { length: number; nextIndex: number } {
    let best = { length: 0, nextIndex: 0 };
    for (let i = 0; i < prev.length; i++) {
        for (let j = 0; j < next.length; j++) {
            let k = 0;
            while (i + k < prev.length && j + k < next.length && prev[i + k] === next[j + k]) k++;
            if (k > best.length) best = { length: k, nextIndex: j };
        }
    }
    return best;
}

/** True when the reply starts on the same two words as any sentence of the line before. */
function opensLikeASentenceOf(prev: DialogueParagraph, reply: DialogueParagraph): boolean {
    return prev.sentenceStarts.some(
        (at) => prev.spoken[at] === reply.spoken[0] && prev.spoken[at + 1] === reply.spoken[1]
    );
}

function hasContentWord(words: string[], ignore?: Set<string>): boolean {
    return words.some((w) => w.length >= 3 && !STOP_WORDS_SLOP.has(w) && !(ignore && ignore.has(w)));
}

/**
 * Finds replies that reuse the wording of the spoken line before them. Two
 * spoken paragraphs count as an exchange when at most one paragraph of
 * narration sits between them.
 */
export function detectDialogueEchoes(
    text: string,
    options?: { minPhraseWords?: number; ignoreWords?: Set<string> }
): DialogueEcho[] {
    const minPhraseWords = Math.max(2, options?.minPhraseWords || 3);
    const ignore = options?.ignoreWords;
    const paragraphs = splitDialogueParagraphs(text);
    const echoes: DialogueEcho[] = [];
    let prev: DialogueParagraph | null = null;
    let gap = 0;

    paragraphs.forEach((p) => {
        if (p.spoken.length === 0) {
            gap++;
            if (gap > 1) prev = null;
            return;
        }
        if (prev) {
            const shared = longestSharedRun(prev.spoken, p.spoken);
            const sharedWords = p.spoken.slice(shared.nextIndex, shared.nextIndex + shared.length);
            if (shared.length >= minPhraseWords && hasContentWord(sharedWords, ignore)) {
                echoes.push({ start: p.spokenStart, end: p.end, phrase: sharedWords.join(' '), kind: 'phrase' });
            } else if (
                p.spoken.length >= 3 &&
                prev.spoken.length >= 3 &&
                opensLikeASentenceOf(prev, p) &&
                !OPENING_IGNORED_FIRST_WORDS.has(p.spoken[0]) &&
                !(ignore && ignore.has(p.spoken[0]))
            ) {
                echoes.push({
                    start: p.spokenStart,
                    end: p.end,
                    phrase: `${p.spoken[0]} ${p.spoken[1]}`,
                    kind: 'opening'
                });
            }
        }
        prev = p;
        gap = 0;
    });
    return echoes;
}

const DIALOGUE_SHAPE_IDS = new Set(['dialogue_ping_pong', 'dialogue_echo']);

export function isDialogueShapeHit(hit: { categoryId: string }): boolean {
    return DIALOGUE_SHAPE_IDS.has(hit.categoryId);
}

/** One line per habit, worded for a model that will review or revise the scene. */
export function dialogueShapeAdvisories(
    densityHits: Array<{ categoryId: string; match: string; note?: string }> | null | undefined
): string[] {
    const hits = densityHits || [];
    const advisories: string[] = [];
    const runs = hits.filter((h) => h.categoryId === 'dialogue_ping_pong');
    if (runs.length > 0) {
        const detail = runs.map((h) => (h.note ? `${h.match}, ${h.note}` : h.match)).join('; ');
        advisories.push(
            `Dialogue ping-pong: ${detail}. Break the volley with a paragraph of action, interiority or description, and vary where the tag or beat sits.`
        );
    }
    const echoes = hits.filter((h) => h.categoryId === 'dialogue_echo');
    if (echoes.length > 0) {
        const samples = Array.from(new Set(echoes.map((h) => `"${h.match}"`))).slice(0, 4).join(', ');
        advisories.push(
            `Dialogue echoing: ${echoes.length} replies reuse the previous speaker's words (${samples}). Keep the one that earns it and let the others answer in the speaker's own words.`
        );
    }
    return advisories;
}
