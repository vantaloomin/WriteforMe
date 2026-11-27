/**
 * @module services/rag/localEmbedding
 * The desktop app's built-in embedding model: llama.cpp on this PC's processor, downloaded and
 * started by the app (desktop/lib/embedding.cjs). The page reaches it through the desktop bridge;
 * in a plain browser the bridge is absent and the option is not offered.
 */

import { DEFAULT_EMBEDDING_MODELS, STORAGE_KEYS } from '@/config';

export type LocalEmbeddingStatus = DesktopEmbeddingStatusAmbient;
export type LocalEmbeddingModel = DesktopEmbeddingModelAmbient;

function bridge(): DesktopBackendsBridgeAmbient | undefined {
    return typeof window === 'undefined' ? undefined : window.ellipsisDesktopBackends;
}

function unwrap<T>(result: { ok: boolean; value?: T; error?: string }): T {
    if (!result.ok || result.value === undefined) {
        throw new Error(result.error || 'The built-in embedding model did not answer.');
    }
    return result.value;
}

export function isLocalEmbeddingAvailable(): boolean {
    const b = bridge();
    return Boolean(b?.embed && b.ensureEmbedding && b.getEmbeddingStatus);
}

export async function getLocalEmbeddingStatus(modelId: string): Promise<LocalEmbeddingStatus> {
    const b = bridge();
    if (!b?.getEmbeddingStatus) throw new Error('The built-in embedding model needs the desktop app.');
    return unwrap(await b.getEmbeddingStatus(modelId));
}

/** Downloads what is missing and starts the model. Resolves once it answers requests. */
export async function ensureLocalEmbedding(modelId: string): Promise<LocalEmbeddingStatus> {
    const b = bridge();
    if (!b?.ensureEmbedding) throw new Error('The built-in embedding model needs the desktop app.');
    return unwrap(await b.ensureEmbedding(modelId));
}

export async function embedLocally(
    modelId: string,
    text: string,
    kind: 'query' | 'document'
): Promise<number[] | null> {
    const b = bridge();
    if (!b?.embed) throw new Error('The built-in embedding model needs the desktop app.');
    return unwrap(await b.embed(modelId, [text], kind))[0] ?? null;
}

// --- Which model the writer chose -----------------------------------------------------------

const modelListeners = new Set<() => void>();

export function getLocalEmbeddingModel(): string {
    try {
        return (
            localStorage.getItem(STORAGE_KEYS.localEmbeddingModel) ||
            DEFAULT_EMBEDDING_MODELS.llamacpp
        );
    } catch {
        return DEFAULT_EMBEDDING_MODELS.llamacpp;
    }
}

export function setLocalEmbeddingModel(modelId: string): void {
    try {
        localStorage.setItem(STORAGE_KEYS.localEmbeddingModel, modelId);
    } catch {
        // The choice then lasts until the page closes.
    }
    for (const listener of modelListeners) listener();
}

export function onLocalEmbeddingModelChange(listener: () => void): () => void {
    modelListeners.add(listener);
    return () => {
        modelListeners.delete(listener);
    };
}

// --- Re-indexing once a newly chosen model is running ------------------------------------------

const readyListeners = new Set<() => void>();

/** Subscribes to "a model the lore index was not built with is now running". */
export function onLocalEmbeddingNeedsIndex(listener: () => void): () => void {
    readyListeners.add(listener);
    return () => {
        readyListeners.delete(listener);
    };
}

let lastAsked = '';

/**
 * Call when `modelId` has started. If the lore index was built with something else, it asks
 * subscribers to rebuild it (once per index state), so switching model never leaves the old
 * model's vectors behind.
 */
export function markLocalEmbeddingReady(modelId: string): void {
    let fingerprint: string;
    try {
        fingerprint = localStorage.getItem(STORAGE_KEYS.ragFingerprint) || '';
    } catch {
        return;
    }
    if (fingerprint.includes(`|llamacpp|${modelId}|`)) return;
    const asked = `${modelId}\u0000${fingerprint}`;
    if (asked === lastAsked) return;
    lastAsked = asked;
    for (const listener of readyListeners) listener();
}
