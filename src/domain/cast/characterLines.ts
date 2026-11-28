/**
 * @module domain/cast/characterLines
 * "Characters write their own lines": before a scene is written, each main character in it is
 * asked, as themselves and knowing only what they know, what they want from the moment and what
 * they would say. The writer is then given those lines to use. This module holds the parts that
 * need no model: which scenes and which characters, what each character is told, how an answer
 * is read, and how the lines are shown to the writer.
 */

export type CharacterLinesMode = 'off' | 'key' | 'all';

export const CHARACTER_LINES_CHOICES: ReadonlyArray<{ value: CharacterLinesMode; label: string }> = [
    { value: 'off', label: 'Off' },
    { value: 'key', label: 'Key scenes (the last scene of each sequence)' },
    { value: 'all', label: 'Every scene' }
];

export function isCharacterLinesMode(value: unknown): value is CharacterLinesMode {
    return CHARACTER_LINES_CHOICES.some((choice) => choice.value === value);
}

export const CHARACTER_LINES_LIMITS = { speakers: 4, lines: 4, lineChars: 280, wantsChars: 300, profileChars: 2400 } as const;

/** Whether this scene is one the setting covers. A key scene is the one that closes its sequence. */
export function wantsCharacterLines(mode: CharacterLinesMode, sceneIdx: number, scenesInSequence: number): boolean {
    if (mode === 'all') return true;
    if (mode !== 'key') return false;
    return scenesInSequence > 0 && sceneIdx >= scenesInSequence - 1;
}

export interface SpeakingCastMember {
    id?: string;
    name?: string;
    role?: string;
    corner_role?: string;
    core_flaw?: string;
    core_desire?: string;
    details?: Record<string, unknown> | null;
    [key: string]: unknown;
}

const CORNER_ORDER = ['MAIN_CHARACTER', 'THE_CHALLENGER', 'THE_COMFORTER', 'THE_WARNING'];
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Who is asked: the corner characters in the scene, the main character first, then others, up to
 * four. A scene with fewer than two named people has no one to talk to, so no one is asked.
 */
export function speakingCast<T extends SpeakingCastMember>(cast: ReadonlyArray<T | null | undefined>): T[] {
    const named = cast.filter((member): member is T => Boolean(member && text(member.name)));
    if (named.length < 2) return [];
    const rank = (member: T): number => {
        const at = CORNER_ORDER.indexOf(text(member.corner_role).toUpperCase());
        return at >= 0 ? at : CORNER_ORDER.length;
    };
    return named
        .map((member, index) => ({ member, index }))
        .sort((a, b) => rank(a.member) - rank(b.member) || a.index - b.index)
        .slice(0, CHARACTER_LINES_LIMITS.speakers)
        .map(({ member }) => member);
}

export interface CharacterBriefScene {
    title?: unknown;
    setting?: unknown;
    environment?: unknown;
    entrance_conditions?: unknown;
    surface_activity?: unknown;
    pov_character?: unknown;
    main_character_heart?: unknown;
    other_character_heart?: unknown;
}

export interface CharacterBriefInput {
    member: SpeakingCastMember;
    /** How they speak, as the voice profile describes it. */
    voice: string;
    scene: CharacterBriefScene;
    /** Names of the other people present. */
    others: string[];
    /** How this character sees each other person present, by name. */
    views: Record<string, string>;
}

/**
 * What one character is told before they speak. It holds who they are, where they are and who is
 * there. It leaves out what the scene is planned to do, how it turns and how it ends, since they
 * cannot know that.
 */
export function characterBrief({ member, voice, scene, others, views }: CharacterBriefInput): string {
    const name = text(member.name);
    const details = member.details || {};
    const profile = text(details.deep_profile) || text(details.history);
    const isPov = text(scene.pov_character).toLowerCase() === name.toLowerCase();
    const heart = isPov ? text(scene.main_character_heart) : text(scene.other_character_heart);
    const who = [
        `Name: ${name}`,
        text(member.role) ? `Role in the story: ${text(member.role)}` : '',
        text(member.summary) ? `Who you are: ${text(member.summary)}` : '',
        text(member.core_desire) ? `What you want most: ${text(member.core_desire)}` : '',
        text(member.core_flaw) ? `What gets in your way: ${text(member.core_flaw)}` : '',
        profile ? `In your own words:\n${profile.slice(0, CHARACTER_LINES_LIMITS.profileChars)}` : ''
    ].filter(Boolean);
    const moment = [
        text(scene.setting || scene.environment) ? `Where: ${text(scene.setting || scene.environment)}` : '',
        text(scene.entrance_conditions) ? `As it begins: ${text(scene.entrance_conditions)}` : '',
        text(scene.surface_activity) ? `What people are doing: ${text(scene.surface_activity)}` : '',
        heart ? `What is on your mind: ${heart}` : '',
        others.length > 0 ? `Who is here with you: ${others.join(', ')}` : ''
    ].filter(Boolean);
    const seen = others.filter((other) => text(views[other])).map((other) => `${other}: ${text(views[other])}`);

    return (
        `<who_you_are>\n${who.join('\n')}\n</who_you_are>\n\n` +
        `${voice ? `<your_voice>\n${voice}\n</your_voice>\n\n` : ''}` +
        `<the_moment>\n${moment.join('\n') || 'A scene is about to begin.'}\n</the_moment>` +
        `${seen.length > 0 ? `\n\n<how_you_see_them>\n${seen.join('\n')}\n</how_you_see_them>` : ''}`
    );
}

export interface CharacterLines {
    name: string;
    wants: string;
    lines: string[];
}

function tagged(answer: string, tag: string): string[] {
    const found: string[] = [];
    const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi');
    let match = pattern.exec(answer);
    while (match) {
        found.push(match[1]);
        match = pattern.exec(answer);
    }
    return found;
}

/** A line as spoken words only: no speaker tag, stage directions, wrapping quotes or line breaks. */
export function cleanSpokenLine(raw: string, name: string): string {
    let line = String(raw || '')
        .replace(/\*[^*]*\*/g, ' ')
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const tag = `${name}:`.toLowerCase();
    if (name && line.toLowerCase().startsWith(tag)) line = line.slice(tag.length).trim();
    line = line.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
    if (line.length > CHARACTER_LINES_LIMITS.lineChars) {
        line = `${line.slice(0, CHARACTER_LINES_LIMITS.lineChars - 1).trimEnd()}…`;
    }
    return /\p{L}/u.test(line) ? line : '';
}

/** Reads one character's answer. Null when it holds no usable line. */
export function parseCharacterLines(answer: unknown, name: string): CharacterLines | null {
    const source = typeof answer === 'string' ? answer : '';
    const lines: string[] = [];
    for (const raw of tagged(source, 'line')) {
        const line = cleanSpokenLine(raw, name);
        if (line && !lines.some((kept) => kept.toLowerCase() === line.toLowerCase())) lines.push(line);
        if (lines.length >= CHARACTER_LINES_LIMITS.lines) break;
    }
    if (lines.length === 0) return null;
    const wants = (tagged(source, 'wants')[0] || '').replace(/\s+/g, ' ').trim().slice(0, CHARACTER_LINES_LIMITS.wantsChars);
    return { name, wants, lines };
}

const escapeXml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The lines as the writer sees them, or '' when no one answered. */
export function characterLinesBlock(entries: ReadonlyArray<CharacterLines>): string {
    const usable = entries.filter((entry) => entry.lines.length > 0);
    if (usable.length === 0) return '';
    const people = usable
        .map(
            (entry) =>
                `<character name="${escapeXml(entry.name).replace(/"/g, '&quot;')}">\n` +
                `${entry.wants ? `  <wants>${escapeXml(entry.wants)}</wants>\n` : ''}` +
                `${entry.lines.map((line) => `  <line>${escapeXml(line)}</line>`).join('\n')}\n</character>`
        )
        .join('\n');
    return `<character_lines>
[IN THEIR OWN WORDS: Each character below was asked, as themselves and knowing only what they know, what they want from this scene and what they would say in it. They did not know how the scene goes. Work these lines into the dialogue where the scene reaches them, in their wording or close to it. You decide when each is said, who answers and what comes of it. Leave out a line the scene's events rule out; never bend the scene's events to fit a line.]
${people}
</character_lines>`;
}
