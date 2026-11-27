import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/config';
import { useLocalEmbeddingReindex } from '@/hooks';
import {
    EmbeddingService,
    getLocalEmbeddingModel,
    isLocalEmbeddingAvailable,
    setLocalEmbeddingModel
} from '@/services/rag';
import { SettingsLocalEmbedding } from '@/views/settings/SettingsLocalEmbedding';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Status = DesktopEmbeddingStatusAmbient;

const MODELS: Status['models'] = [
    { id: 'embeddinggemma-2', name: 'EmbeddingGemma 2', bytes: 309855456, memoryMb: 350, installed: false, source: '' },
    { id: 'qwen3-embedding-0.6b', name: 'Qwen3 Embedding 0.6B', bytes: 639150592, memoryMb: 950, installed: false, source: '' },
    { id: 'file:C:\\m\\nomic-embed.gguf', name: 'nomic-embed.gguf', bytes: 1e8, memoryMb: null, installed: true, source: 'LM Studio' }
];

function status(patch: Partial<Status> = {}): Status {
    return { available: true, state: 'off', message: '', received: 0, total: 0, models: MODELS, ...patch };
}

/** A desktop bridge whose setup finishes when the test says so. */
function installBridge(initial: Status) {
    let current = initial;
    const pending: Array<{ resolve: () => void; reject: (message: string) => void }> = [];
    const ensureEmbedding = vi.fn(
        (modelId: string) =>
            new Promise<{ ok: boolean; value?: Status; error?: string }>((done) => {
                void modelId;
                pending.push({
                    resolve: () => done({ ok: true, value: current }),
                    reject: (error) => done({ ok: false, error })
                });
            })
    );
    const embed = vi.fn(async (...[, texts]: [string, string[], 'query' | 'document']) => ({
        ok: true,
        value: texts.map(() => [1, 2, 3])
    }));
    window.ellipsisDesktopBackends = {
        isDesktop: true,
        ensureKoboldRunning: vi.fn(async () => ({ ok: true, value: { ready: true, started: false } })),
        openBackendsWindow: vi.fn(async () => ({ ok: true })),
        onEvent: vi.fn(() => () => {}),
        getEmbeddingStatus: vi.fn(async () => ({ ok: true, value: current })),
        ensureEmbedding,
        embed
    };
    return {
        ensureEmbedding,
        embed,
        set: (next: Status) => {
            current = next;
        },
        finish: () => pending.shift()?.resolve(),
        fail: (message: string) => pending.shift()?.reject(message)
    };
}

let container: HTMLDivElement;
let root: Root;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete window.ellipsisDesktopBackends;
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('built-in embedding provider', () => {
    it('is offered only where the desktop app can run it', () => {
        expect(isLocalEmbeddingAvailable()).toBe(false);
        expect(new EmbeddingService('', 'llamacpp').isConfigured()).toBe(false);
        installBridge(status());
        expect(isLocalEmbeddingAvailable()).toBe(true);
        expect(new EmbeddingService('', 'llamacpp').isConfigured()).toBe(true);
    });

    it('embeds through the desktop bridge and names the model in the index fingerprint', async () => {
        const bridge = installBridge(status());
        const service = new EmbeddingService('', 'llamacpp', undefined, undefined, 'qwen3-embedding-0.6b');
        expect(service.getProviderLabel()).toBe('llamacpp|qwen3-embedding-0.6b');
        expect(new EmbeddingService('', 'llamacpp').getProviderLabel()).toBe('llamacpp|embeddinggemma-2');

        await expect(service.getEmbedding('The Red Keep')).resolves.toEqual([1, 2, 3]);
        await service.getEmbedding('who rules?', 'query');
        expect(bridge.embed.mock.calls).toEqual([
            ['qwen3-embedding-0.6b', ['The Red Keep'], 'document'],
            ['qwen3-embedding-0.6b', ['who rules?'], 'query']
        ]);
    });

    it('surfaces the desktop app\'s reason when the model cannot answer', async () => {
        const bridge = installBridge(status());
        bridge.embed.mockResolvedValueOnce({ ok: false, error: 'llama.cpp could not load the model: bad magic' } as never);
        await expect(new EmbeddingService('', 'llamacpp').getEmbedding('x')).rejects.toThrow('bad magic');
    });
});

describe('SettingsLocalEmbedding', () => {
    it('sets the default model up by itself and shows the download, then Ready', async () => {
        const bridge = installBridge(status({ state: 'downloading', received: 100e6, total: 329e6 }));
        act(() => root.render(<SettingsLocalEmbedding />));
        await flush();

        expect(bridge.ensureEmbedding).toHaveBeenCalledWith('embeddinggemma-2');
        const select = container.querySelector('select') as HTMLSelectElement;
        expect(select.value).toBe('embeddinggemma-2');
        expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
            'EmbeddingGemma 2 · 310 MB',
            'Qwen3 Embedding 0.6B · 639 MB',
            'nomic-embed.gguf · LM Studio'
        ]);
        expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('30');
        expect(container.textContent).toContain('100 MB of 329 MB');

        bridge.set(status({ state: 'downloading', received: 300e6, total: 329e6 }));
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(container.textContent).toContain('300 MB of 329 MB');

        bridge.set(status({ state: 'ready' }));
        bridge.finish();
        await flush();
        expect(container.textContent).toContain('Ready');
        expect(container.querySelector('[role="progressbar"]')).toBeNull();
    });

    it('choosing another model remembers it and sets that one up', async () => {
        const bridge = installBridge(status({ state: 'ready' }));
        act(() => root.render(<SettingsLocalEmbedding />));
        await flush();

        const select = container.querySelector('select') as HTMLSelectElement;
        act(() => {
            select.value = 'qwen3-embedding-0.6b';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await flush();
        expect(getLocalEmbeddingModel()).toBe('qwen3-embedding-0.6b');
        expect(localStorage.getItem(STORAGE_KEYS.localEmbeddingModel)).toBe('qwen3-embedding-0.6b');
        expect(bridge.ensureEmbedding).toHaveBeenLastCalledWith('qwen3-embedding-0.6b');
    });

    it('shows why setup failed and tries again on request', async () => {
        const bridge = installBridge(status({ state: 'starting' }));
        act(() => root.render(<SettingsLocalEmbedding />));
        await flush();
        bridge.set(status({ state: 'failed', message: 'Checksum mismatch for embeddinggemma-2-Q8_0.gguf' }));
        bridge.fail('Checksum mismatch');
        await flush();
        await flush();

        expect(container.querySelector('[role="alert"]')?.textContent).toContain('Checksum mismatch');
        const again = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Try again'));
        act(() => again?.click());
        await flush();
        expect(bridge.ensureEmbedding).toHaveBeenCalledTimes(2);
    });
});

describe('useLocalEmbeddingReindex', () => {
    function Harness({ rebuild, active }: { rebuild: () => void; active: boolean }) {
        useLocalEmbeddingReindex(rebuild, active);
        return null;
    }

    it('rebuilds the lore index once a model it was not built with is running', async () => {
        const bridge = installBridge(status({ state: 'ready' }));
        localStorage.setItem(STORAGE_KEYS.ragFingerprint, 'story_1|gemini|gemini-embedding-001|4|abc');
        const rebuild = vi.fn();
        act(() => root.render(<Harness rebuild={rebuild} active />));
        await flush();
        expect(bridge.ensureEmbedding).toHaveBeenCalledWith('embeddinggemma-2');
        expect(rebuild).not.toHaveBeenCalled();

        bridge.finish();
        await flush();
        expect(rebuild).toHaveBeenCalledTimes(1);

        // The index now matches: switching away and back does not rebuild it again.
        localStorage.setItem(STORAGE_KEYS.ragFingerprint, 'story_1|llamacpp|qwen3-embedding-0.6b|4|abc');
        act(() => setLocalEmbeddingModel('qwen3-embedding-0.6b'));
        await flush();
        bridge.finish();
        await flush();
        expect(rebuild).toHaveBeenCalledTimes(1);
    });

    it('does nothing while another provider is chosen', async () => {
        const bridge = installBridge(status());
        const rebuild = vi.fn();
        act(() => root.render(<Harness rebuild={rebuild} active={false} />));
        await flush();
        expect(bridge.ensureEmbedding).not.toHaveBeenCalled();
    });
});
