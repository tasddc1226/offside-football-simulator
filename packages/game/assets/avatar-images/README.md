# Player PNG sources

The player renderer uses original transparent PNG bytes, without dot conversion, resampling, repainting or facial-feature reconstruction. `generation.json` records the exact ImageGen prompt, grid and SHA-256 for every source. These are project-owned generated football characters, not photographs or replicas of real players.

- Nine legacy hairstyles: short, fringe, long, mohawk, slick, buzz, afro, bun, spiky
- Each original `*-A` sheet has ten poses; each `*-B` has seven poses plus standing
- Nine `heads-*` sheets contain complete head/neck illustrations: seven expressions × three beard states
- `army-A/B` preserve long camo sleeves and trousers during motion
- `army`, `injured`, `retired` are source wardrobe/state concepts; injury and retirement remain still with their props
- `accessories` contains headband, goggles, wrist cuff, captain band, forehead bandage and knee wrap

`avatar-image.ts` composes the same layers in web SVG and React Native SVG. Uniform scales and viewports preserve source geometry. Colour filters preserve existing appearance selections; source PNG pixels are never rewritten. Kit pattern overlays are masked to the original fabric, not used to redraw the anatomy. Existing goal, ball and trophy artwork remains outside this conversion scope.

Metadata can be regenerated (read-only image analysis):

```sh
node tooling/scripts/measure-avatar-images.mjs
```

This writes measured crop/face/skin anchors to `packages/game/src/avatar-image-data.json` and checksums/prompts to the manifest. It never writes PNGs. Native references are static Metro assets; web PNG URLs receive content hashes and are fetched only when used. The local review page intentionally loads more poses/styles than the game.

These source PNGs total about 40 MiB. A hairstyle normally needs its B sheet and head sheet; its A sheet loads when motion is needed. Original source quality takes priority over generated low-resolution replacements. Measure payload, decode memory and native SVG filter performance on representative devices before release; native bundle success alone is not visual/performance proof.
