/**
 * @module domain/story/summaryCheck
 * Checks a rewritten "story so far" before it replaces the old one.
 *
 * Each update asks a model to rewrite the running summary. Nothing stopped a rewrite from quietly
 * dropping a name, a number or a promise the earlier summary held, and over a long novel those
 * are the things later scenes depend on. Before a new summary is used, code checks that every
 * known name, every number and every quote in the summary before it is still there, along with
 * any pledge said aloud in the newly drafted text. What a second try still drops is added after
 * the summary word for word, so an update is never blocked and nothing live is lost.
 */

// A number as a story writes it: 40, 3.5, 9:30, 1,200.
const NUMBER = /(?<![\w.:,])\d+(?:[:.,]\d+)*/g;
// The small numbers a summary may write as words.
const NUMBER_WORDS = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'
];
const QUOTE = /["“]([^"“”]{3,300})["”]/g;
// Words said aloud that bind or threaten someone later: these are kept word for word.
const PLEDGE =
    /\b(promise[sd]?|swear|swore|sworn|vow(?:ed|s)?|oath|owe[sd]?|debt|bargain|deal|my word|kill you|you'll pay|confess(?:ed)?|never tell|on my (?:life|honou?r|mother|name))\b/i;

/** Never more than this many things to keep from one update, so the retry note stays readable. */
export const SUMMARY_KEEP_LIMIT = 40;

export interface KeptItem {
    kind: 'name' | 'number' | 'quote';
    text: string;
    /** Other forms that count as the same name ("Mara" for "Mara Quillon"). */
    alternatives?: string[];
}

const escapeRx = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = (text: string, flags = 'i') => new RegExp(`(?<![\\w])${escapeRx(text)}(?![\\w])`, flags);

/** Text as the check compares it: straight quotes, single spaces, no case. */
function plain(text: string): string {
    return String(text || '')
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .split(/\s+/)
        .join(' ')
        .trim()
        .toLowerCase();
}

export function numbersIn(text: string): string[] {
    return Array.from(new Set(String(text || '').match(NUMBER) || []));
}

export function quotesIn(text: string, pledgesOnly = true): string[] {
    const found: string[] = [];
    for (const match of String(text || '').matchAll(QUOTE)) {
        const quote = match[1].split(/\s+/).join(' ').trim();
        if (quote && (!pledgesOnly || PLEDGE.test(quote)) && !found.includes(quote)) found.push(quote);
    }
    return found;
}

/** The forms a known name may take in a summary: the full name, then each word of it worth matching. */
function nameForms(name: string): string[] {
    const full = name.trim();
    const words = full.split(/\s+/).filter((word) => word.length > 2 && /^[A-Z]/.test(word));
    return Array.from(new Set([full, ...words]));
}

export interface SummaryKeepSource {
    /** The summary being replaced. */
    before: string;
    /** Newly drafted text being folded in. Only pledges said aloud are kept from it. */
    folded?: string;
    /** Names the story knows: cast first, then places or anything else that must not vanish. */
    knownNames?: readonly string[];
}

/**
 * What the new summary must keep: every quote the summary before already kept, pledges said aloud
 * in the new text, and the known names and numbers the summary before mentions.
 */
export function summaryMustKeep({ before, folded = '', knownNames = [] }: SummaryKeepSource): KeptItem[] {
    const prior = String(before || '');
    const quotes: KeptItem[] = Array.from(new Set([...quotesIn(prior, false), ...quotesIn(folded)])).map((text) => ({
        kind: 'quote',
        text
    }));
    const names: KeptItem[] = [];
    const seenNames = new Set<string>();
    knownNames.forEach((raw) => {
        const name = String(raw || '').trim();
        if (!name || !/^[A-Z]/.test(name)) return;
        const forms = nameForms(name);
        const found = forms.find((form) => wholeWord(form).test(prior));
        if (!found || seenNames.has(name.toLowerCase())) return;
        seenNames.add(name.toLowerCase());
        names.push({ kind: 'name', text: found, alternatives: forms.filter((form) => form !== found) });
    });
    const numbers: KeptItem[] = numbersIn(prior).map((text) => ({ kind: 'number', text }));
    return [...quotes, ...names, ...numbers].slice(0, SUMMARY_KEEP_LIMIT);
}

export function summaryHolds(item: KeptItem, text: string): boolean {
    const source = String(text || '');
    if (item.kind === 'quote') return plain(source).includes(plain(item.text).replace(/[.,!?]+$/, ''));
    if (item.kind === 'number') {
        if (new RegExp(`(?<![\\d.:,])${escapeRx(item.text)}(?![\\d])`).test(source)) return true;
        const small = /^\d+$/.test(item.text) ? Number(item.text) : NaN;
        return small < NUMBER_WORDS.length && new RegExp(`\\b${NUMBER_WORDS[small]}\\b`, 'i').test(source);
    }
    return [item.text, ...(item.alternatives || [])].some((form) => wholeWord(form).test(source));
}

export function summaryDropped(items: readonly KeptItem[], text: string): KeptItem[] {
    return items.filter((item) => !summaryHolds(item, text));
}

const shown = (item: KeptItem) => (item.kind === 'quote' ? `"${item.text}"` : item.text);

/** Added to the summarizer's prompt when its draft dropped something. */
export function summaryRetryNote(missing: readonly KeptItem[]): string {
    return `<dropped_from_last_draft>
Your last draft dropped things that must stay in the story so far. Write the summary again and keep each of these, names and numbers as given and quoted words exactly as said:
${missing.map((item) => `- ${shown(item)}`).join('\n')}
</dropped_from_last_draft>`;
}

/** The summary with what it still leaves out added after it, word for word. */
export function summaryWithKept(text: string, missing: readonly KeptItem[]): string {
    if (missing.length === 0) return text;
    const line = `Also kept: ${missing.map(shown).join('; ')}.`;
    return text ? `${text}\n\n${line}` : line;
}

export interface CheckedSummary {
    text: string;
    /** What the draft in use still dropped, before `summaryWithKept` added it back. */
    missing: KeptItem[];
    retried: boolean;
}

/**
 * Asks for a summary and checks it. `draft(note)` is called once with no note and, when its
 * summary drops something, once more with what it dropped. The draft that drops less is kept,
 * and a failed second ask keeps the first. What is still dropped is added after the summary.
 */
export async function checkedSummary(
    draft: (note: string) => Promise<string>,
    items: readonly KeptItem[]
): Promise<CheckedSummary> {
    let text = await draft('');
    let missing = summaryDropped(items, text);
    let retried = false;
    if (missing.length > 0 && text) {
        retried = true;
        try {
            const second = await draft(summaryRetryNote(missing));
            const secondMissing = second ? summaryDropped(items, second) : missing;
            if (second && secondMissing.length < missing.length) {
                text = second;
                missing = secondMissing;
            }
        } catch {
            // The first draft is kept, with what it dropped added after it.
        }
    }
    return { text: text ? summaryWithKept(text, missing) : text, missing, retried };
}
