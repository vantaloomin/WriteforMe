/**
 * @module domain/audio/spokenLines
 * Finds what a character actually says in their interview. An interview mixes the interviewer's
 * questions, scene-setting narration and the character's quoted answers; only the answers belong
 * in a voice reference transcript or a dialogue sample.
 */

const QUOTED = /[“"]([^“”"]+)[”"]/g;

/** A line that is only a heading, a bold line, or an interviewer prompt. */
function isQuestionLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^#{1,6}\s/.test(trimmed)) return true;
    if (/^(\*\*|__).+(\*\*|__)\s*$/.test(trimmed)) return true;
    if (/^(q\d*|question(\s*\d+)?|interviewer)\s*[:.)-]/i.test(trimmed)) return true;
    return /\?$/.test(trimmed) && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
}

/** The interview without tags, question lines and inline bold questions. */
export function stripInterviewQuestions(interviewText: unknown): string {
    if (typeof interviewText !== 'string') return '';
    return interviewText
        .replace(/\r\n/g, '\n')
        .replace(/<[^>]+>/g, ' ')
        .split('\n')
        .filter((line) => !isQuestionLine(line))
        .join('\n')
        .replace(/(\*\*|__)[^*_\n]*\?\s*(\*\*|__)/g, ' ')
        .replace(/^[^a-z\n]*[A-Z][^a-z\n]*\?\s+(?=[A-Z][a-z])/gm, '')
        .trim();
}

function closeSentence(segment: string): string {
    return /[.!?…]$/.test(segment) ? segment : `${segment.replace(/[,;:—-]+$/, '').trim()}.`;
}

/**
 * Every quoted line the character speaks, in order, as plain sentences. A quote split by a
 * dialogue tag ("I carry things," she says, "and letters.") is joined back into one sentence.
 */
export function extractSpokenLines(interviewText: unknown): string {
    const spoken: string[] = [];
    for (const paragraph of stripInterviewQuestions(interviewText).split(/\n+/)) {
        const segments = Array.from(paragraph.matchAll(QUOTED), (match) =>
            match[1].replace(/[*_]+/g, '').replace(/\s+/g, ' ').trim()
        ).filter(Boolean);
        let open = '';
        for (const segment of segments) {
            const continues = open && /^[a-z]/.test(segment);
            if (open && !continues) spoken.push(closeSentence(open));
            const joined = continues ? `${open} ${segment}` : segment;
            if (/,$/.test(segment)) {
                open = joined;
            } else {
                spoken.push(closeSentence(joined));
                open = '';
            }
        }
        if (open) spoken.push(closeSentence(open));
    }
    return spoken.join(' ');
}

export const SPOKEN_SAMPLE_MAX_CHARS = 160;

/**
 * A short line of the character's own speech for the card: whole sentences up to the limit.
 * With no quoted speech (a first-person interview) it uses the opening of the answer instead.
 */
export function spokenSample(interviewText: unknown, maxChars = SPOKEN_SAMPLE_MAX_CHARS): string {
    const source =
        extractSpokenLines(interviewText) ||
        stripInterviewQuestions(interviewText)
            .replace(/[*_#]+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    if (!source) return '';
    const sentences = source.match(/[^.!?…]+[.!?…]+/g)?.map((s) => s.trim()) || [source];
    let sample = '';
    for (const sentence of sentences) {
        if (sample && `${sample} ${sentence}`.length > maxChars) break;
        sample = sample ? `${sample} ${sentence}` : sentence;
    }
    if (sample.length <= maxChars) return sample;
    return `${sample.slice(0, maxChars).replace(/\s+\S*$/, '')}…`;
}

/** True when a stored sample is the old kind: the raw opening of the interview, cut short. */
export function isLegacyInterviewSample(sample: unknown, interviewText: unknown): boolean {
    if (typeof sample !== 'string' || typeof interviewText !== 'string') return false;
    const head = sample.replace(/\.{3}$/, '').trim();
    return head.length > 0 && interviewText.trim().startsWith(head);
}
