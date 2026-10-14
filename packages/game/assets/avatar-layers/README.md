# Player layer atlases

Players are drawn as paper dolls: the same bald base body for every look, with outfit, expression, beard, hair and accessory layers laid over it. Changing a hairstyle swaps only the hair layer, so the face, neck and shoulders never change shape between looks.

Each PNG is one pose (`stand`, `runL`, … 18 in all) holding every layer for that pose:
- `base`: bald body, calm face, white undershirt and shorts, bare feet.
- `kit`, `army`, `suit` (standing only): outfits. Kit shirt, shorts, socks and boots are separate tintable parts.
- `expr-*` (six expressions), `beard-stubble`, `beard-full`, `hair-*` (nine hairstyles). `hair-*-back` is the hair hanging below the collar, drawn behind the body.
- `band-*` (a headband drawn over each hairstyle), `goggles`, `wrist`, `armband`, plus standing-only `bandage`, `crutch`, `bouquet`.

Packing by pose keeps decoded memory small, because every look on a screen shares one bitmap per pose. A card or list needs only `stand` (about 3 MB decoded), and a motion needs the few poses it plays. This matters on Android, where react-native-svg only draws images held in Fresco's memory cache (192 MB pool). `packages/game/src/avatar-layers.json` lists each pose's head and shirt boxes and its parts as `[atlas x, y, w, h, pose x, pose y]`. Tintable parts (skin, hair, kit pieces, accessory colours) are greyscale with their main tone at 0.75, and the renderer multiplies them by the chosen colour. Every pixel is either fully opaque or fully transparent, so there is no halo on dark backgrounds. The atlases are 0.6× the generated sheets (figures about 220 px tall).

These are project-owned generated football characters, not photographs or replicas of real players. They were made with Codex image_gen. Each layer is a one-change edit of the base sheet ("add only this hair", "dress only in this kit") on a flat magenta background, then keyed and cut against the base. The pipeline and the exact prompts are in `tooling/avatar-layers` (see its README).
