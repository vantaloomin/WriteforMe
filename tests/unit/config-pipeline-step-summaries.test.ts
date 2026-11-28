import { describe, expect, it } from 'vitest';
import { PIPELINE_STEPS_META } from '@/config';

const JARGON = /\b(xml|yaml|json|rag|agent|model|prompt|vector|tier|gate|schema)\b/i;

describe('pipeline step summaries', () => {
    it('gives every step one plain sentence', () => {
        for (const step of PIPELINE_STEPS_META) {
            expect(step.summary, `step ${step.id}`).toMatch(/^[A-Z].+\.$/);
            expect(step.summary.length, `step ${step.id}`).toBeLessThanOrEqual(100);
        }
    });

    it('keeps pipeline jargon out of them', () => {
        for (const step of PIPELINE_STEPS_META) {
            expect(step.summary, `step ${step.id}`).not.toMatch(JARGON);
        }
    });

    it('does not repeat a summary', () => {
        const summaries = PIPELINE_STEPS_META.map((step) => step.summary);
        expect(new Set(summaries).size).toBe(summaries.length);
    });
});
