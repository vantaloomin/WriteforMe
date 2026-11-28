/**
 * @module views/cast/CastCards
 * The list of character cards and the large reader that any of them opens.
 */

import { useState } from 'react';
import { CharacterCard, CharacterReader, type ReaderSectionId } from '@/components';
import type { CastCharacterRecord, CastViewProps } from './CastView';

export interface CastCardsProps extends Pick<
    CastViewProps,
    | 'story'
    | 'loadedImages'
    | 'portraitLoading'
    | 'isAnyAudioPlaying'
    | 'isAuditioningVoice'
    | 'openEditModal'
    | 'generateCharacterPortrait'
    | 'uploadCharacterPortrait'
    | 'removeCharacterPortrait'
    | 'handleRerollCharacterSeed'
    | 'handleResetCharacterReferenceText'
    | 'testAuditionCharacterVoice'
    | 'stopAllAudioPlayback'
> {
    saveCastField: (c: CastCharacterRecord, i: number, field: string, newValue: string) => void;
}

interface ReaderTarget {
    index: number;
    section?: ReaderSectionId;
}

export function CastCards({
    story,
    loadedImages,
    portraitLoading,
    isAnyAudioPlaying,
    isAuditioningVoice,
    openEditModal,
    saveCastField,
    generateCharacterPortrait,
    uploadCharacterPortrait,
    removeCharacterPortrait,
    handleRerollCharacterSeed,
    handleResetCharacterReferenceText,
    testAuditionCharacterVoice,
    stopAllAudioPlayback
}: CastCardsProps) {
    const [reader, setReaderState] = useState<ReaderTarget | null>(null);
    // Read reopens on the tab last read, so going through the cast stays on, say, Interview.
    const [lastSection, setLastSection] = useState<ReaderSectionId | undefined>();
    const setReader = (next: ReaderTarget | null) => {
        if (next?.section) setLastSection(next.section);
        setReaderState(next);
    };
    const cast = story.cast || [];
    const reading = reader ? cast[reader.index] : null;
    const portraitOf = (c: CastCharacterRecord) => loadedImages.portraits?.[c.id || ''] ?? null;
    const editField = (
        c: CastCharacterRecord,
        i: number,
        field: string,
        title: string,
        val?: string
    ) => openEditModal(title, val || '', (newValue) => saveCastField(c, i, field, newValue));

    return (
        <div className="flex flex-col gap-6">
            {cast.map((c, i) => (
                <CharacterCard
                    key={i}
                    c={c}
                    story={story}
                    onAuditionVoice={testAuditionCharacterVoice}
                    onRecalibrateVoice={(target) =>
                        testAuditionCharacterVoice(target, { forceRecalibrate: true })
                    }
                    onRerollVoiceSeed={handleRerollCharacterSeed}
                    isAuditioningVoice={isAuditioningVoice}
                    isAnyAudioPlaying={isAnyAudioPlaying}
                    stopAllAudioPlayback={stopAllAudioPlayback}
                    portraitSrc={portraitOf(c)}
                    portraitLoading={!!portraitLoading[c.id || '']}
                    onGeneratePortrait={generateCharacterPortrait}
                    onUploadPortrait={uploadCharacterPortrait}
                    onRemovePortrait={removeCharacterPortrait}
                    onEdit={(field, title, val) => {
                        if (field === 'reset_reference_text') {
                            handleResetCharacterReferenceText(c);
                            return;
                        }
                        editField(c, i, field, title, val);
                    }}
                    onEditInline={(field, value) => saveCastField(c, i, field, value)}
                    onRead={(section) => setReader({ index: i, section: section || lastSection })}
                />
            ))}
            {reader && reading && (
                <CharacterReader
                    character={reading}
                    section={reader.section}
                    portraitSrc={portraitOf(reading)}
                    onClose={() => setReader(null)}
                    onSectionChange={(section) => setReader({ index: reader.index, section })}
                    onStep={
                        cast.length > 1
                            ? (delta) => setReader({ ...reader, index: reader.index + delta })
                            : undefined
                    }
                    hasPrevious={reader.index > 0}
                    hasNext={reader.index < cast.length - 1}
                    onEdit={(field, title, val) =>
                        editField(reading, reader.index, field, title, val)
                    }
                />
            )}
        </div>
    );
}
