# Knowledge base

Gems search this folder with the `knowledge_search` tool and cite what they find, so advice comes from a document rather than the model's memory.

- Add Markdown (`.md`) or plain-text (`.txt`) files. Headings split a file into passages.
- Put a `Source: <url>` line near the top so the source travels with every passage.
- With a Gemini key, passages are searched by meaning (Gemini Embeddings, cached in `data/`). Without one, by keywords.
- Plugins can ship their own knowledge in `plugins/knowledge/`.

**The three files here are short starter summaries for the demo.** Before relying on them, replace or extend them with the official documents for your area: NDMA and state disaster-management guidelines, scheme rules from the department's .gov.in site, and medicine information from the product leaflet.
