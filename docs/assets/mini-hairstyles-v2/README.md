# Additional mini hairstyles

T-11-243 adds six user-selected original hairstyle designs to the mini character system.

| Wire value | Style | Source |
| --- | --- | --- |
| y9 | Fully bald | source/bald.png |
| y10 | Closely shaved | source/shaved.png |
| y11 | Dreadlocks | source/dread.png |
| y12 | Spiked mohawk | source/fauxhawk.png |
| y13 | Ponytail | source/ponytail.png |
| y14 | Two-tone mullet | source/mullet.png |

The source PNGs are idle figures cropped from concept sheets produced with the built-in image generator and selected by the user. The footballer references describe hairstyles; the faces remain original game characters. These are source artwork, not runtime images.

Run `node tooling/scripts/prepare-mini-hairstyles.mjs` from the repository root to regenerate the material maps. The converter aligns the source eyes to the mini grid, fits the scalp silhouette above them, preserves the canonical standing body and replaces the head in all 17 existing short-style body poses. Separate foreground arm materials preserve raised hands and wristbands. Source normalization measurements are in `normalization.json`.

The runtime uses 48×64 standing maps and lazy-loaded 64×72 pose maps. Web SVG and React Native SVG share the same colored rectangles, card crop and popup animation timeline. No pose timing, simulation RNG, game calculations or save shape changes.

Skin, primary hair, kit and accessories remain recolorable. Shaved scalp shadow blends the selected skin and hair colors; the mullet's lower hair stays darker than its upper hair. Choose the existing gold hair color for the blond references. Fully bald has no scalp-hair material. Facial marks and independently selected beards still render.

Values y0–y8 and the four ID-derived default styles stay unchanged. The API cosmetic validator accepts the six appended values. Existing retirement appearance limits and permanent transfer-history locks are unchanged. Old clients ignore unfamiliar style values and retain a valid default.
