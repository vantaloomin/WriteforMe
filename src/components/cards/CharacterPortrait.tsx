/**
 * @module components/cards/CharacterPortrait
 * The portrait on a character card with its generate, upload and remove buttons.
 */

import { useRef } from 'react';
import { Loader2, Sparkles, Trash2, Upload, User } from '@/components/icons';

export interface CharacterPortraitProps {
    name: string;
    src?: string | null;
    loading?: boolean;
    onGenerate?: () => void;
    onUpload?: (file: File) => void;
    onRemove?: () => void;
}

export function CharacterPortrait({
    name,
    src,
    loading = false,
    onGenerate,
    onUpload,
    onRemove
}: CharacterPortraitProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    return (
        <div className="w-[72px] md:w-24 shrink-0 space-y-2 md:row-span-2">
            <div className="w-[72px] h-24 md:w-24 md:h-32 rounded-xl bg-gold-tint border border-gold-edge overflow-hidden flex items-center justify-center text-gold-ink font-bold font-serif text-2xl shadow-sm">
                {src ? (
                    <img
                        src={src}
                        alt={`Portrait of ${name || 'character'}`}
                        className="w-full h-full object-cover"
                    />
                ) : name ? (
                    name.charAt(0).toUpperCase()
                ) : (
                    <User size={24} />
                )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
                {onGenerate && (
                    <button
                        type="button"
                        title="Generate"
                        aria-label={`Generate portrait for ${name}`}
                        disabled={loading}
                        onClick={() => onGenerate?.()}
                        className="p-1.5 shrink-0 rounded-lg bg-surface border border-edge text-gold-ink hover:bg-gold-tint disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Sparkles size={14} />
                        )}
                    </button>
                )}
                {onUpload && (
                    <button
                        type="button"
                        title="Upload"
                        aria-label={`Upload portrait for ${name}`}
                        disabled={loading}
                        onClick={() => inputRef.current?.click()}
                        className="p-1.5 shrink-0 rounded-lg bg-surface border border-edge text-ink-600 hover:bg-gold-tint disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Upload size={14} />
                    </button>
                )}
                {src && onRemove && (
                    <button
                        type="button"
                        title="Remove"
                        aria-label={`Remove portrait for ${name}`}
                        disabled={loading}
                        onClick={() => onRemove?.()}
                        className="p-1.5 shrink-0 rounded-lg bg-surface border border-edge text-ink-600 hover:bg-gold-tint disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
                {!onGenerate && !onUpload && !onRemove && (
                    <span className="p-1.5 rounded-lg bg-surface border border-edge text-ink-400">
                        <User size={16} />
                    </span>
                )}
            </div>
            {onUpload && (
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={loading}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file && !loading) onUpload?.(file);
                    }}
                />
            )}
        </div>
    );
}
