import { describe, expect, it } from 'vitest';
import {
    estimateReferenceTextSeconds,
    extractPersonalizedReferenceTextFromInterview,
    extractSpokenLines,
    isLegacyInterviewSample,
    spokenSample,
    stripInterviewQuestions
} from '@/domain/audio';

const INTERVIEW = `The Orchard Launderette, a wet Tuesday, gone two in the morning. Dulcie is out the back with the service washes. Kit has a dryer on the go and no intention of sitting down while it runs.

**What do you do, and what does a typical day look like for you?**

Kit props one trainer on the bench and re-ties a lace that was fine. "I carry things. Parcels, letters, the odd jar you don't tilt. Somebody on the Kerb has a thing in Deptford that wants to be in Vauxhall, and they don't want it opened, leaned on or left in a minicab boot." She yanks the knot tight. "Cash up front," she says, "and sealed stays sealed. I'm up about two in the afternoon, on the bike by four, done when the night buses hand over to the day ones."

**What are you most afraid of?**

"Owing somebody," Kit says.`;

describe('extractSpokenLines', () => {
    it('keeps only what the character says', () => {
        const spoken = extractSpokenLines(INTERVIEW);
        expect(spoken.startsWith('I carry things. Parcels, letters')).toBe(true);
        expect(spoken).not.toMatch(/Launderette|typical day|props one trainer|yanks|afraid/);
        expect(spoken).not.toMatch(/[*"“”]/);
    });

    it('joins a quote split by a dialogue tag and closes a trailing comma', () => {
        const spoken = extractSpokenLines(INTERVIEW);
        expect(spoken).toContain('Cash up front, and sealed stays sealed.');
        expect(spoken.endsWith('Owing somebody.')).toBe(true);
    });

    it('reads curly quotes', () => {
        expect(extractSpokenLines('Toby shrugs. “I fix bikes. That is all.”')).toBe(
            'I fix bikes. That is all.'
        );
    });
});

describe('stripInterviewQuestions', () => {
    it('drops headings, bold questions and shouted questions', () => {
        const text = stripInterviewQuestions(
            '## Interview\nWHAT DO YOU DO, AND WHAT DOES A TYPICAL DAY LOOK LIKE FOR YOU?\nToby is sitting on a crate.\nQ: And then?\n**Why?** He laughs.'
        );
        expect(text).toBe('Toby is sitting on a crate.\n  He laughs.');
    });

    it('drops a shouted question that shares a line with the answer', () => {
        expect(stripInterviewQuestions('WHAT DO YOU DO? Toby is sitting on a crate.')).toBe(
            'Toby is sitting on a crate.'
        );
    });
});

describe('voice reference transcript', () => {
    it('is built from spoken lines, not the scene setting or the question', () => {
        const ref = extractPersonalizedReferenceTextFromInterview(INTERVIEW);
        expect(ref.startsWith('I carry things.')).toBe(true);
        expect(ref).not.toMatch(/Launderette|typical day|\*/);
        expect(estimateReferenceTextSeconds(ref)).toBeGreaterThanOrEqual(15);
    });

    it('falls back to the answer text when nothing is quoted', () => {
        const monologue =
            '**Where did you grow up?**\n\nI grew up near the docks where the foghorns never stopped singing before dawn. Every morning my father checked the brass barometer and counted the outgoing trawlers by hull color. When the harbor froze in ninety-two, we burned crate timber in an iron stove just to keep the ledger ink from thickening.';
        const ref = extractPersonalizedReferenceTextFromInterview(monologue);
        expect(ref.startsWith('I grew up near the docks')).toBe(true);
    });
});

describe('spokenSample', () => {
    it('is a short run of whole spoken sentences', () => {
        const sample = spokenSample(INTERVIEW);
        expect(sample).toBe("I carry things. Parcels, letters, the odd jar you don't tilt.");
    });

    it('recognises the old kind of sample so it can be replaced', () => {
        const old = `${INTERVIEW.split('.')[0].substring(0, 100)}...`;
        expect(isLegacyInterviewSample(old, INTERVIEW)).toBe(true);
        expect(isLegacyInterviewSample('I carry things.', INTERVIEW)).toBe(false);
    });
});
