# Built-in embeddings

Lore search (RAG) needs an embedding model. In the desktop app, Settings > Model Options > Embedding Provider has **Built-in**: the app downloads llama.cpp and a small embedding model, starts it, and rebuilds the lore index. Picking the provider is the whole setup. Ported from Prospero's Companion (`providers/builtin_recall.py`).

A plain browser has no way to start a program, so the option is shown only in the desktop app.

## What the writer sees

| Step | Screen |
| --- | --- |
| Pick **Built-in** | A model list and a download bar (about 330 MB the first time). |
| Download done | `Starting…`, then `Ready`. The lore index rebuilds by itself. |
| Pick another model | Same again for that model. The index rebuilds with it. |
| Something fails | The reason, and **Try again**. |

## Models

| Model | Download | Memory while running |
| --- | --- | --- |
| EmbeddingGemma 2 (default) | 310 MB | about 350 MB |
| Qwen3 Embedding 0.6B | 639 MB | about 950 MB |

The list also shows embedding `.gguf` files already on the PC: any file with `embed` in its name under the app's `embedding-models` and `text-models` folders or LM Studio's model folders. `ELLIPSISPROSE_EMBEDDING_MODELS` adds folders (separated like `PATH`).

## How it runs

- llama.cpp is the pinned build `b11457`, checked against its SHA-256. The two suggested models are checked the same way. Files land in `<backends folder>/llamacpp/` and `<backends folder>/embedding-models/`.
- `llama-server` runs in embedding mode on a free loopback port, **on the processor only** (`-ngl 0`), with at most four threads and a 2,048-token context. Texts are cut to 6,000 characters.
- Because it never touches the graphics card, it takes no lease from the VRAM coordinator and is never unloaded by it. KoboldCpp, ComfyUI and audio.cpp keep the whole card.
- It starts when the provider is chosen or on the first embedding request, and stops with the app.
- Search queries and stored lore get the instructions each model was trained with (EmbeddingGemma, Qwen3, nomic, mxbai, Arctic).
- The page never calls the server. It asks the desktop app over IPC (`getEmbeddingStatus`, `ensureEmbedding`, `embed`), so there is no port to configure and no CORS.
- `ELLIPSISPROSE_LLAMA_SERVER` names a `llama-server` of your own to use instead of the download.

## Where the code is

| Path | Holds |
| --- | --- |
| `desktop/lib/embedding.cjs` | Pinned runtime and models, model search, download, start, embed. |
| `desktop/main.cjs`, `desktop/preload-main.cjs` | The three IPC calls. |
| `src/services/rag/localEmbedding.ts` | The page's side of the bridge, the chosen model, the re-index signal. |
| `src/services/rag/embeddingService.ts` | Provider `llamacpp`. Its fingerprint label includes the model id. |
| `src/hooks/useLocalEmbedding.ts` | Setup progress for Settings; keeps the model set up and re-indexes from the shell. |
| `src/views/settings/SettingsLocalEmbedding.tsx` | The model list and progress. |
| `desktop/test/embedding.test.cjs`, `tests/unit/local-embedding.test.tsx` | Tests. The desktop tests use a stand-in server. |

## Adding a model

Add an entry to `MODELS` in `desktop/lib/embedding.cjs` with its direct download link, byte size and SHA-256 (Hugging Face shows the SHA-256 on the file's page). If the model was trained with instructions, add them to `PROMPTS`.
