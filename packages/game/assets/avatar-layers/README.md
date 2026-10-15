# Player layer atlases

Players are drawn as paper dolls: the same bald base body for every look, with outfit, expression, beard, hair and accessory layers laid over it. Changing a hairstyle swaps only the hair layer, so the face, neck and shoulders never change shape between looks.

`stand.png` is the standing pose holding every layer. The game draws only this pose (T-11-270 removed the motion scenes, so the other 17 pose atlases are no longer shipped):
- `base`: bald body, calm face, white undershirt and shorts, bare feet.
- `kit`, `keeper` (long-sleeve goalkeeper kit), `army`, `suit` (standing only): outfits. Kit and keeper shirt, shorts, socks and boots are separate tintable parts.
- `expr-*` (six expressions), `beard-stubble`, `beard-full`, `hair-*` (fourteen hairstyles; `bald` has no hair layer because the base head is already bald). `hair-*-back` is the hair hanging below the collar, drawn behind the body.
- `band-*` (a headband drawn over each hairstyle, `band-bald` over the bare head), `goggles`, `wrist`, `gloves`, `kneepads`, `armband`, plus standing-only `bandage`, `crutch`, `bouquet`.

Every look on a screen shares this one bitmap (about 3 MB decoded). `packages/game/src/avatar-layers.json` lists the pose's head and shirt boxes, its head scale reference (`headRef`) and its parts as `[atlas x, y, w, h, pose x, pose y]`. Each player is composited once and cached: the web draws it into one canvas (`apps/web/src/ui/avatarComposite.ts`), and the app captures it once into a PNG (`apps/mobile/src/ui/AvatarBaker.tsx`). Layering 20–30 tinted images live on every repaint stalled screens with many players. Tintable parts (skin, hair, kit pieces, accessory colours) are greyscale with their main tone at 0.75, and the renderer multiplies them by the chosen colour. Every pixel is either fully opaque or fully transparent, so there is no halo on dark backgrounds. The atlases are 0.6× the generated sheets (figures about 220 px tall).

These are project-owned generated football characters, not photographs or replicas of real players. They were made with Codex image_gen. Each layer is a one-change edit of the base sheet ("add only this hair", "dress only in this kit") on a flat magenta background, then keyed and cut against the base. The pipeline and the exact prompts are in `tooling/avatar-layers` (see its README).
