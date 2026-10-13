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

## 키퍼 용품

머리 모양과 별개로 `gloves`(없음 + 5색), `keeperKit`(구단 유니폼 + 긴팔 4색),
`kneePads`(없음 + 3색)를 조합합니다. 기존 선택지 순서를 바꾸지 않고 wire code
`l`·`u`·`n`을 뒤에 추가합니다. 기존 저장에 항목이 없으면 0과 같은 기본 차림입니다.
추가 필드는 모두 선택 사항이며 마이그레이션으로 기존 외형이나 자금을 바꾸지 않습니다.

`avatar-mini-equipment.ts`는 기존 재질 지도의 피부·소매·반바지 경계를 사용해
자세별 팔과 무릎을 칠합니다. 캐시한 부위는 같은 자세에서 다시 탐색하지 않습니다.
장갑이 손목 밴드보다 앞에 표시되고, 벗으면 선택한 밴드가 다시 보입니다.
선수 카드의 얼굴·어깨 크롭은 유지하며 키퍼 유니폼 색이 어깨에 반영됩니다.
은퇴식 정장과 군복에는 경기 용품을 덮지 않고, 은퇴 편집기의 유니폼 미리보기와
카드·전성기 모습에는 저장된 용품을 표시합니다. 포지션·기록·능력치에는 영향이 없습니다.
