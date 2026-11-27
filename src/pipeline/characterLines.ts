/**
 * @module pipeline/characterLines
 * Asks each main character in a scene, one call each, what they want from it and what they would
 * say, and returns the block the writer is given. A character is told only who they are, where
 * they are and who is with them, from the same secret-scrubbed profile the writer sees, so a line
 * cannot give away what the story has not revealed. A failed call only means that character has
 * no lines; it never stops the scene from being written.
 */

import { getVoiceDescriptionForCharacter, type AudioStoryLike, type VoiceCastMember } from '@/domain/audio';
import {
    characterBrief,
    characterLinesBlock,
    parseCharacterLines,
    speakingCast,
    wantsCharacterLines,
    type CharacterLines
} from '@/domain/cast';
import { SAFEGUARD_PROMPTS } from '@/prompts';
import { isModelStop } from '@/services/llm';
import { getFeatureOptions } from '@/stores';
import type { PipelineRuntimeContext } from './context';
import { asRecord, asString } from './context';
import {
    sanitizeActiveCast,
    unrevealedSecretsAt,
    type ProseContextCastMember,
    type ProseContextStoryInput
} from './proseContext';

export interface CharacterLinesRequest {
    story: ProseContextStoryInput;
    scene: Record<string, unknown>;
    seq: number;
    s: number;
    scenesInSequence: number;
    sequenceNumber: number;
    activeCast: ProseContextCastMember[];
}

/** How one character sees another, from the story's relationships (keyed "from->to" by name or id). */
function viewOf(story: ProseContextStoryInput, from: ProseContextCastMember, to: ProseContextCastMember): string {
    const relationships = story.relationships;
    if (!relationships || Array.isArray(relationships)) return '';
    const all = relationships as Record<string, unknown>;
    const found = all[`${from.name}->${to.name}`] || (from.id && to.id ? all[`${from.id}->${to.id}`] : undefined);
    const rel = asRecord(found);
    return [asString(rel.dynamic || rel.type), asString(rel.hidden_tension || rel.tension)].filter(Boolean).join('. ');
}

/** The `<character_lines>` block for this scene, or '' when the setting is off or no one answered. */
export async function gatherCharacterLines(ctx: PipelineRuntimeContext, request: CharacterLinesRequest): Promise<string> {
    const mode = getFeatureOptions().characterLines;
    if (!wantsCharacterLines(mode, request.s, request.scenesInSequence)) return '';

    const cast = sanitizeActiveCast(request.activeCast, unrevealedSecretsAt(request.story, request.sequenceNumber));
    const speakers = speakingCast(cast);
    if (speakers.length === 0) return '';

    const present = cast.filter((member) => member && member.name);
    ctx.setLoadingStep(`Characters: asking ${speakers.length} for their own lines...`);
    const entries: CharacterLines[] = [];
    for (const member of speakers) {
        const name = String(member.name);
        const others = present.filter((other) => other !== member);
        const views: Record<string, string> = {};
        others.forEach((other) => {
            views[String(other.name)] = viewOf(request.story, member, other);
        });
        const brief = characterBrief({
            member,
            voice: getVoiceDescriptionForCharacter(member as VoiceCastMember, request.story as unknown as AudioStoryLike),
            scene: request.scene,
            others: others.map((other) => String(other.name)),
            views
        });
        try {
            const answer = await ctx.callAI(
                brief,
                SAFEGUARD_PROMPTS.characterLines,
                false,
                `Character Lines: ${name} (Scene ${request.seq + 1}.${request.s + 1})`,
                'prose'
            );
            const read = parseCharacterLines(asString(answer), name);
            if (read) entries.push(read);
        } catch (err) {
            if (isModelStop(err)) throw err;
            console.warn(`[Character Lines] ${name} gave no lines:`, err);
        }
    }
    return characterLinesBlock(entries);
}
