# Original PNG avatar sources

These seven PNGs are byte-identical copies of `docs/assets/mini-character-v3/concepts/`.
The original prompts, references and SHA-256 hashes are recorded in that directory's `generation.json`.

`frames.json` contains source-pixel bounding boxes for standing, running and shooting, in that order. Bounds were measured from the PNG alpha channel with four pixels of padding; the PNG was not resized, quantised, recoloured or re-encoded.

`OriginalPngAvatar.svelte` displays the whole source PNG through an explicit clipping viewport. It preserves aspect ratio and uses normal bitmap interpolation. The portrait uses the upper 58% of the standing frame. Both source art and transparency are unchanged.

The local review page uses one selected source at a time. The existing appearance save schema has no new values or migration. Per-career source mapping, recolouring and the full animated pose set remain outside this review implementation.
