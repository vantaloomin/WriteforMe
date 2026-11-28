/**
 * @module components/cards/CharacterCard
 * Rich character dossier card with Four-Corner dilemma breakdown, portrait controls,
 * and Breeze 2 7-dimension voice profile + reference transcript inspection.
 */

import {
    FileText,
    Maximize2,
    MessageSquare,
    RefreshCw,
    RotateCcw,
    Square,
    Volume2
} from '@/components/icons';
import {
    estimateReferenceTextSeconds,
    extractPersonalizedReferenceTextFromInterview,
    getDeterministicVoiceSeed,
    getVoiceDescriptionForCharacter,
    getVoiceReferenceTextForCharacter,
    resolveSpeakerVoiceIdentity,
    type AudioStoryLike,
    type VoiceCastMember
} from '@/domain/audio';
import { parseMarkdown } from '@/utils';
import { CORNER_ROLE_OPTIONS, cornerRoleLabel, STORY_ROLE_PRESETS } from '@/config';
import { EditButton } from '../common/EditButton';
import { InlineChoiceField } from '../common/InlineChoiceField';
import { CharacterPortrait } from './CharacterPortrait';
import { READER_SECTION_TITLES, type ReaderSectionId } from './characterReaderSections';

export interface CharacterCardCharacter extends VoiceCastMember {
    role?: string;
    summary?: string;
    why_it_makes_sense?: string;
    what_it_costs_them?: string;
    way_of_living?: string;
    why_it_is_appealing?: string;
    shared_outlook?: string;
    the_hidden_trap?: string;
    how_they_ended_up?: string;
    the_wake_up_call?: string;
    voice_sample?: string;
    vocal_cadence?: string;
    voice_seed?: number;
    details?: {
        story_events?: string;
        goals?: string;
        history?: string;
        deep_profile?: string;
        vocal_profile?: string;
        [key: string]: unknown;
    };
}

const TAG_CLASS =
    'text-[10px] uppercase font-mono font-bold border px-2 py-0.5 rounded-full break-words min-w-0';

const READ_BUTTON_CLASS =
    'text-xs font-semibold text-ink-700 hover:text-ink-900 flex items-center gap-2 px-4 py-2.5 bg-mist-50 rounded-xl border border-edge-strong hover:bg-wash transition-colors';

const SEED_CLASS =
    'text-[9px] font-mono px-1.5 py-0.5 rounded bg-gold-tint border border-gold-edge text-gold-ink font-semibold';

export interface CharacterCardProps {
    c: CharacterCardCharacter | null;
    story?: AudioStoryLike | null;
    onEdit?: (fieldPath: string, label: string, currentValue?: string) => void;
    /** Saves a short field edited in place on the card (name, role, corner role). */
    onEditInline?: (fieldPath: string, value: string) => void;
    /** Opens this character in the large reader, on the given tab when one is named. */
    onRead?: (section?: ReaderSectionId) => void;
    onAuditionVoice?: (
        char: CharacterCardCharacter,
        opts?: { forceRecalibrate?: boolean }
    ) => void;
    onRecalibrateVoice?: (char: CharacterCardCharacter) => void;
    onRerollVoiceSeed?: (char: CharacterCardCharacter) => void;
    isAuditioningVoice?: boolean;
    isAnyAudioPlaying?: boolean;
    stopAllAudioPlayback?: () => void;
    portraitSrc?: string | null;
    portraitLoading?: boolean;
    onGeneratePortrait?: (char: CharacterCardCharacter) => void;
    onUploadPortrait?: (char: CharacterCardCharacter, file: File) => void;
    onRemovePortrait?: (char: CharacterCardCharacter) => void;
}

export function CharacterCard({
    c,
    story,
    onEdit,
    onEditInline,
    onRead,
    onAuditionVoice,
    onRecalibrateVoice,
    onRerollVoiceSeed,
    isAuditioningVoice = false,
    isAnyAudioPlaying = false,
    stopAllAudioPlayback,
    portraitSrc,
    portraitLoading = false,
    onGeneratePortrait,
    onUploadPortrait,
    onRemovePortrait
}: CharacterCardProps) {
    const hasSheet = typeof c?.details?.sheet === 'string' && Boolean(c.details.sheet);
    if (!c) return null;

    const resolvedVoiceProfile = getVoiceDescriptionForCharacter(c, story) || c.vocal_cadence || '';
    const resolvedVoiceSeed = getDeterministicVoiceSeed(c, story) || c.voice_seed || 101010;
    const resolvedReferenceText = getVoiceReferenceTextForCharacter(c, story) || c.reference_text || '';
    const resolvedSigHash = resolveSpeakerVoiceIdentity(c, story)?.sigHash || '';
    const resolvedReferenceSeconds = Math.round(estimateReferenceTextSeconds(resolvedReferenceText));
    const resolvedReferenceWords = (String(resolvedReferenceText || '').match(/\b[\w'’]+\b/g) || []).length;
    const isCustomReferenceText = Boolean(
        c.user_edited_reference_text || story?.user_edited?.[`cast.${c.name}.reference_text`]
    );
    const isRefMatchingProfile = Boolean(
        resolvedReferenceText &&
            resolvedVoiceProfile &&
            resolvedReferenceText.trim().replace(/[.!?]+$/g, '').toLowerCase() ===
                resolvedVoiceProfile.trim().replace(/[.!?]+$/g, '').toLowerCase()
    );
    const interviewSourceForBadge =
        c.details?.deep_profile ||
        c.interview_psychology ||
        c.deep_profile ||
        c.canonical_interview_voice ||
        '';
    const hasInterviewSource = Boolean(
        extractPersonalizedReferenceTextFromInterview(interviewSourceForBadge)
    );

    return (
        <div className="bg-surface rounded-2xl border border-edge overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div className="p-5 border-b border-edge bg-inset grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3">
                <CharacterPortrait
                    name={c.name || ''}
                    src={portraitSrc}
                    loading={portraitLoading}
                    onGenerate={onGeneratePortrait && (() => onGeneratePortrait(c))}
                    onUpload={onUploadPortrait && ((file) => onUploadPortrait(c, file))}
                    onRemove={onRemovePortrait && (() => onRemovePortrait(c))}
                />
                <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            {onEditInline ? (
                                <InlineChoiceField
                                    label="Name"
                                    value={c.name || ''}
                                    onCommit={(next) => onEditInline('name', next)}
                                    className="text-lg font-bold font-serif text-ink-900 px-1 -mx-1"
                                />
                            ) : (
                                <h3 className="text-lg font-bold font-serif text-ink-900 break-words min-w-0">
                                    {c.name}
                                </h3>
                            )}
                        </div>
                        {onRead && (
                            <button
                                type="button"
                                onClick={() => onRead()}
                                aria-label={`Open ${c.name}`}
                                title="Open"
                                className="character-read shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-ink-600 bg-surface border border-edge-strong hover:bg-wash hover:text-ink-900 transition-colors"
                            >
                                <Maximize2 size={15} />
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {onEditInline ? (
                            <>
                                <InlineChoiceField
                                    label="Role"
                                    value={c.role || ''}
                                    placeholder="Role"
                                    options={STORY_ROLE_PRESETS}
                                    onCommit={(next) => onEditInline('role', next)}
                                    className={`${TAG_CLASS} text-ink-600 bg-inset border-edge-strong`}
                                />
                                <InlineChoiceField
                                    label="Four-Corner role"
                                    value={c.corner_role || ''}
                                    placeholder="Four-Corner role"
                                    options={CORNER_ROLE_OPTIONS}
                                    allowCustom={false}
                                    onCommit={(next) => onEditInline('corner_role', next)}
                                    className={`${TAG_CLASS} text-gold-ink bg-gold-tint border-gold-edge`}
                                />
                            </>
                        ) : (
                            <>
                                <span className={`${TAG_CLASS} text-ink-600 bg-inset border-edge-strong`}>
                                    {c.role}
                                </span>
                                <span className={`${TAG_CLASS} text-gold-ink bg-gold-tint border-gold-edge`}>
                                    {cornerRoleLabel(c.corner_role)}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                {c.summary && (
                    <div className="character-summary col-span-2 md:col-span-1 md:col-start-2 flex items-start gap-2">
                        <p className="text-sm text-ink-600 leading-relaxed min-w-0 max-w-prose">{c.summary}</p>
                        {onEdit && (
                            <EditButton
                                className="p-1 min-w-6 min-h-6 shrink-0"
                                title="Summary"
                                value={c.summary || ''}
                                onSave={() => onEdit('summary', 'Summary', c.summary || '')}
                            />
                        )}
                    </div>
                )}
            </div>

            <div className="p-5 space-y-4">
                {(c.corner_role ||
                    c.why_it_makes_sense ||
                    c.what_it_costs_them ||
                    c.way_of_living ||
                    c.shared_outlook ||
                    c.how_they_ended_up ||
                    c.the_wake_up_call) && (
                    <div className="bg-gold-tint/30 p-4 rounded-xl border border-gold-edge/60 space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase tracking-wider text-gold-ink">
                            <span>
                                ⚖️ Four-Corner Dilemma Dynamic (
                                {cornerRoleLabel(c.corner_role) || 'Web Reflection'})
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-serif">
                            {(c.why_it_makes_sense || c.corner_role === 'MAIN_CHARACTER') && (
                                <div className="p-2.5 bg-surface/80 rounded-lg border border-edge">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <strong className="text-[10px] font-mono uppercase text-ink-500">
                                            Why It Makes Sense (Safety Habit):
                                        </strong>
                                        {onEdit && (
                                            <EditButton
                                                className="p-1 min-w-6 min-h-6 shrink-0"
                                                title="Why It Makes Sense"
                                                value={c.why_it_makes_sense || ''}
                                                onSave={() =>
                                                    onEdit(
                                                        'why_it_makes_sense',
                                                        'Why It Makes Sense',
                                                        c.why_it_makes_sense || ''
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    <span className="text-ink-800 leading-snug">
                                        {c.why_it_makes_sense || (
                                            <span className="italic text-ink-400">
                                                Click edit to define why this habit makes sense.
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                            {(c.what_it_costs_them || c.corner_role === 'MAIN_CHARACTER') && (
                                <div className="p-2.5 bg-surface/80 rounded-lg border border-edge">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <strong className="text-[10px] font-mono uppercase text-ink-500">
                                            What It Costs Them:
                                        </strong>
                                        {onEdit && (
                                            <EditButton
                                                className="p-1 min-w-6 min-h-6 shrink-0"
                                                title="What It Costs Them"
                                                value={c.what_it_costs_them || ''}
                                                onSave={() =>
                                                    onEdit(
                                                        'what_it_costs_them',
                                                        'What It Costs Them',
                                                        c.what_it_costs_them || ''
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    <span className="text-ink-800 leading-snug">
                                        {c.what_it_costs_them || (
                                            <span className="italic text-ink-400">
                                                Click edit to define personal cost.
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                            {(c.way_of_living || c.corner_role === 'THE_CHALLENGER') && (
                                <div className="p-2.5 bg-surface/80 rounded-lg border border-edge">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <strong className="text-[10px] font-mono uppercase text-ink-500">
                                            Way of Living (Foil Perspective):
                                        </strong>
                                        {onEdit && (
                                            <EditButton
                                                className="p-1 min-w-6 min-h-6 shrink-0"
                                                title="Way of Living"
                                                value={c.way_of_living || ''}
                                                onSave={() =>
                                                    onEdit(
                                                        'way_of_living',
                                                        'Way of Living',
                                                        c.way_of_living || ''
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    <span className="text-ink-800 leading-snug">
                                        {c.way_of_living || (
                                            <span className="italic text-ink-400">
                                                Click edit to define challenger&apos;s way of living.
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                            {(c.why_it_is_appealing || c.corner_role === 'THE_CHALLENGER') && (
                                <div className="p-2.5 bg-surface/80 rounded-lg border border-edge">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <strong className="text-[10px] font-mono uppercase text-ink-500">
                                            Why It Pulls Protagonist:
                                        </strong>
                                        {onEdit && (
                                            <EditButton
                                                className="p-1 min-w-6 min-h-6 shrink-0"
                                                title="Why It Pulls Protagonist"
                                                value={c.why_it_is_appealing || ''}
                                                onSave={() =>
                                                    onEdit(
                                                        'why_it_is_appealing',
                                                        'Why It Pulls Protagonist',
                                                        c.why_it_is_appealing || ''
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    <span className="text-ink-800 leading-snug">
                                        {c.why_it_is_appealing || (
                                            <span className="italic text-ink-400">
                                                Click edit to define magnetic appeal.
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                            {(c.shared_outlook || c.corner_role === 'THE_COMFORTER') && (
                                <div className="p-2.5 bg-surface/80 rounded-lg border border-edge">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <strong className="text-[10px] font-mono uppercase text-ink-500">
                                            Shared Outlook:
                                        </strong>
                                        {onEdit && (
                                            <EditButton
                                                className="p-1 min-w-6 min-h-6 shrink-0"
                                                title="Shared Outlook"
                                                value={c.shared_outlook || ''}
                                                onSave={() =>
                                                    onEdit(
                                                        'shared_outlook',
                                                        'Shared Outlook',
                                                        c.shared_outlook || ''
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    <span className="text-ink-800 leading-snug">
                                        {c.shared_outlook || (
                                            <span className="italic text-ink-400">
                                                Click edit to define shared comfort outlook.
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                            {(c.the_hidden_trap || c.corner_role === 'THE_COMFORTER') && (
                                <div className="p-2.5 bg-surface/80 rounded-lg border border-edge">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <strong className="text-[10px] font-mono uppercase text-ink-500">
                                            The Hidden Trap (Stagnation):
                                        </strong>
                                        {onEdit && (
                                            <EditButton
                                                className="p-1 min-w-6 min-h-6 shrink-0"
                                                title="The Hidden Trap"
                                                value={c.the_hidden_trap || ''}
                                                onSave={() =>
                                                    onEdit(
                                                        'the_hidden_trap',
                                                        'The Hidden Trap',
                                                        c.the_hidden_trap || ''
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    <span className="text-ink-800 leading-snug">
                                        {c.the_hidden_trap || (
                                            <span className="italic text-ink-400">
                                                Click edit to define the hidden stagnation trap.
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                            {(c.how_they_ended_up || c.corner_role === 'THE_WARNING') && (
                                <div className="p-2.5 bg-surface/80 rounded-lg border border-edge">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <strong className="text-[10px] font-mono uppercase text-ink-500">
                                            How They Ended Up:
                                        </strong>
                                        {onEdit && (
                                            <EditButton
                                                className="p-1 min-w-6 min-h-6 shrink-0"
                                                title="How They Ended Up"
                                                value={c.how_they_ended_up || ''}
                                                onSave={() =>
                                                    onEdit(
                                                        'how_they_ended_up',
                                                        'How They Ended Up',
                                                        c.how_they_ended_up || ''
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    <span className="text-ink-800 leading-snug">
                                        {c.how_they_ended_up || (
                                            <span className="italic text-ink-400">
                                                Click edit to define how they ended up here.
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                            {(c.the_wake_up_call || c.corner_role === 'THE_WARNING') && (
                                <div className="p-2.5 bg-surface/80 rounded-lg border border-edge">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <strong className="text-[10px] font-mono uppercase text-ink-500">
                                            The Wake-Up Call:
                                        </strong>
                                        {onEdit && (
                                            <EditButton
                                                className="p-1 min-w-6 min-h-6 shrink-0"
                                                title="The Wake-Up Call"
                                                value={c.the_wake_up_call || ''}
                                                onSave={() =>
                                                    onEdit(
                                                        'the_wake_up_call',
                                                        'The Wake-Up Call',
                                                        c.the_wake_up_call || ''
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                    <span className="text-ink-800 leading-snug">
                                        {c.the_wake_up_call || (
                                            <span className="italic text-ink-400">
                                                Click edit to define the wake-up call mirror.
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-inset p-5 rounded-xl border border-edge-strong">
                        <div className="flex justify-between items-center gap-2 mb-1.5">
                            <div className="text-xs text-ink-500 font-bold uppercase tracking-wider font-mono">
                                Current Status &amp; Arc
                            </div>
                            {onEdit && (
                                <EditButton
                                    className="p-1.5 min-w-7 min-h-7 shrink-0"
                                    title="Status"
                                    value={c.details?.story_events}
                                    onSave={() =>
                                        onEdit(
                                            'details.story_events',
                                            'Status',
                                            c.details?.story_events
                                        )
                                    }
                                />
                            )}
                        </div>
                        <div className="text-xs text-ink-800 leading-relaxed whitespace-pre-wrap">
                            {c.details?.story_events || 'Active in story world.'}
                        </div>
                    </div>

                    <div className="bg-inset p-5 rounded-xl border border-edge-strong">
                        <div className="flex justify-between items-center gap-2 mb-1.5">
                            <div className="text-xs text-ink-500 font-bold uppercase tracking-wider font-mono">
                                Core Yearning &amp; Motivation
                            </div>
                            {onEdit && (
                                <EditButton
                                    className="p-1.5 min-w-7 min-h-7 shrink-0"
                                    title="Yearning & Motivation"
                                    value={c.details?.goals}
                                    onSave={() =>
                                        onEdit(
                                            'details.goals',
                                            'Yearning & Motivation',
                                            c.details?.goals
                                        )
                                    }
                                />
                            )}
                        </div>
                        <div className="text-xs text-ink-800 leading-relaxed">
                            {c.details?.goals || 'Quiet yearning yet to unfold.'}
                        </div>
                    </div>
                </div>

                {c.details?.history && (
                    <div className="bg-inset p-5 rounded-xl border border-edge-strong">
                        <div className="flex justify-between items-center gap-2 mb-1">
                            <div className="text-xs text-ink-500 font-bold uppercase tracking-wider font-mono">
                                {READER_SECTION_TITLES.history}
                            </div>
                            {onEdit && (
                                <EditButton
                                    className="p-1.5 min-w-7 min-h-7 shrink-0"
                                    title="History"
                                    value={c.details?.history}
                                    onSave={() =>
                                        onEdit('details.history', 'History', c.details?.history)
                                    }
                                />
                            )}
                        </div>
                        <div
                            className="text-xs text-ink-700 leading-relaxed prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: parseMarkdown(c.details.history) }}
                        />
                    </div>
                )}

                <div className="bg-inset p-5 rounded-xl border border-edge-strong">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Volume2 size={13} className="text-gold-ink shrink-0" />
                            <span className="text-[9px] text-ink-500 font-bold uppercase tracking-wider font-mono">
                                Voice Profile (Breeze 2 Instruct)
                            </span>
                            {onEditInline ? (
                                <InlineChoiceField
                                    label={`Voice seed for ${c.name}`}
                                    value={String(resolvedVoiceSeed)}
                                    inputMode="numeric"
                                    onCommit={(next) => onEditInline('voice_seed', next)}
                                    renderResting={(edit) => (
                                        <button type="button" onClick={edit} className={SEED_CLASS}>
                                            Seed: #{resolvedVoiceSeed}
                                        </button>
                                    )}
                                />
                            ) : (
                                <span className={SEED_CLASS}>Seed: #{resolvedVoiceSeed}</span>
                            )}
                            {resolvedSigHash && (
                                <span
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface border border-edge text-ink-600 font-semibold"
                                    title={`Active Voice Signature Hash: ${resolvedSigHash} (updates whenever profile, seed, or reference transcript changes)`}
                                >
                                    Sig: {resolvedSigHash}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {onRerollVoiceSeed && (
                                <button
                                    type="button"
                                    onClick={() => onRerollVoiceSeed(c)}
                                    className="px-2 py-1 rounded-lg border border-edge-strong bg-surface hover:bg-wash text-ink-700 hover:text-ink-900 text-[10px] font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1"
                                    title={`Re-roll Voice Seed for ${c.name}`}
                                >
                                    <RotateCcw size={11} className="text-gold-ink" /> Seed
                                </button>
                            )}
                            {(onRecalibrateVoice || onAuditionVoice) && (
                                <button
                                    type="button"
                                    disabled={isAuditioningVoice && !isAnyAudioPlaying}
                                    onClick={() =>
                                        onRecalibrateVoice
                                            ? onRecalibrateVoice(c)
                                            : onAuditionVoice?.(c, { forceRecalibrate: true })
                                    }
                                    className="px-2 py-1 rounded-lg border border-edge-strong bg-surface hover:bg-wash text-ink-700 hover:text-ink-900 text-[10px] font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                    title={`Force Breeze 2 to recalibrate a fresh Master WAV for ${c.name} and play it`}
                                >
                                    <RefreshCw size={11} className="text-gold-ink" /> Recalibrate
                                </button>
                            )}
                            {onAuditionVoice && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        isAnyAudioPlaying && stopAllAudioPlayback
                                            ? stopAllAudioPlayback()
                                            : onAuditionVoice(c)
                                    }
                                    className="px-2.5 py-1 rounded-lg border border-gold-edge bg-gold-tint hover:bg-gold-tint/80 text-gold-ink text-[10px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1"
                                    title={
                                        isAnyAudioPlaying
                                            ? 'Stop playing audio'
                                            : `Audition ${c.name}'s Master Voice`
                                    }
                                >
                                    {isAnyAudioPlaying ? (
                                        <>
                                            <Square size={10} className="fill-current" /> Stop
                                        </>
                                    ) : (
                                        <>
                                            <Volume2 size={11} /> Audition
                                        </>
                                    )}
                                </button>
                            )}
                            {onEdit && (
                                <EditButton
                                    className="p-1.5 min-w-7 min-h-7 shrink-0"
                                    title="Voice Profile (Gender, Age, Pitch, Pace, Emotion, Characteristics, Use Case)"
                                    value={resolvedVoiceProfile}
                                    onSave={() =>
                                        onEdit(
                                            'vocal_cadence',
                                            'Voice Profile (Breeze 2 Instruct Prompt)',
                                            resolvedVoiceProfile
                                        )
                                    }
                                />
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-ink-800 leading-relaxed font-serif italic">
                        &quot;{resolvedVoiceProfile}&quot;
                    </div>
                    <div className="text-[10px] text-ink-400 font-mono mt-1.5">
                        7 Dimensions: Gender • Age • Pitch • Pace • Emotion • Characteristics • Use Case (15–40 words, objective acoustic traits, no character names)
                    </div>
                </div>

                <div className="bg-inset p-5 rounded-xl border border-edge-strong">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <MessageSquare size={13} className="text-gold-ink shrink-0" />
                            <span className="text-[9px] text-ink-500 font-bold uppercase tracking-wider font-mono">
                                Voice Reference Transcript (TTS Anchor)
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-mist-200 text-ink-700 font-semibold">
                                ~{resolvedReferenceSeconds}s • {resolvedReferenceWords} words
                            </span>
                            <span
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                                    isCustomReferenceText
                                        ? 'bg-gold-tint border-gold-edge text-gold-ink'
                                        : 'bg-surface border-edge text-ink-500'
                                }`}
                            >
                                {isCustomReferenceText
                                    ? 'Custom'
                                    : hasInterviewSource
                                      ? 'Auto from Interview'
                                      : 'Default Fallback'}
                            </span>
                            {isRefMatchingProfile && (
                                <span
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-ember-tint border border-ember-edge text-ember-800 font-semibold"
                                    title="Reference transcript is identical to the Voice Profile description, so Breeze 2 speaks the description aloud as the cloning anchor."
                                >
                                    Matches voice profile
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {onEdit && isCustomReferenceText && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onEdit(
                                            'reset_reference_text',
                                            `Reset Voice Reference Text for ${c.name}`,
                                            ''
                                        )
                                    }
                                    className="px-2 py-1 rounded-lg border border-edge-strong bg-surface hover:bg-wash text-ink-700 hover:text-ink-900 text-[10px] font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1"
                                    title={
                                        hasInterviewSource
                                            ? `Reset ${c.name}'s reference text to the auto-extracted interview excerpt`
                                            : `Reset ${c.name}'s reference text to the default ~17s passage`
                                    }
                                >
                                    <RotateCcw size={11} className="text-gold-ink" /> Reset
                                </button>
                            )}
                            {onEdit && (
                                <EditButton
                                    className="p-1.5 min-w-7 min-h-7 shrink-0"
                                    title={`Voice Reference Transcript for ${c.name} (Spoken by Breeze 2 for Master Voice Cloning)`}
                                    value={resolvedReferenceText}
                                    onSave={() =>
                                        onEdit(
                                            'reference_text',
                                            `Voice Reference Transcript for ${c.name}`,
                                            resolvedReferenceText
                                        )
                                    }
                                />
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-ink-800 leading-relaxed font-serif">
                        {resolvedReferenceText}
                    </div>
                    <div className="text-[10px] text-ink-400 font-mono mt-1.5">
                        Spoken by Breeze 2 to calibrate this character&apos;s master voice (~15–20s full sentences from interview, quotation marks stripped).
                    </div>
                </div>

                {c.voice_sample && (
                    <div className="bg-ember-tint p-5 rounded-xl border border-ember-edge italic text-ember-950 text-xs font-serif leading-relaxed">
                        <span className="text-xs not-italic font-bold font-mono text-gold-ink uppercase mr-1.5 block mb-0.5">
                            Dialogue Sample (Interview Excerpt):
                        </span>
                        &quot;{c.voice_sample}&quot;
                    </div>
                )}

                {onRead && (hasSheet || c.details?.deep_profile) && (
                    <div className="pt-2 border-t border-edge-soft flex flex-wrap gap-2">
                        {hasSheet && (
                            <button type="button" onClick={() => onRead('sheet')} className={READ_BUTTON_CLASS}>
                                <FileText size={12} /> {READER_SECTION_TITLES.sheet}
                            </button>
                        )}
                        {c.details?.deep_profile && (
                            <button type="button" onClick={() => onRead('interview')} className={READ_BUTTON_CLASS}>
                                <MessageSquare size={12} /> {READER_SECTION_TITLES.interview}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
