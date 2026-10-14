# Avatar layer pipeline

This pipeline builds `packages/game/assets/avatar-layers/*.png` and `packages/game/src/avatar-layers.json`. Generated sheets live in a work directory outside the repo (about 2 MB each).

```sh
W=/path/to/work; mkdir -p $W/ref $W/cut $W/out
# ref/short-A.png, ref/short-B.png: the two pose sheets to trace (flattened on white).
# The originals are packages/game/assets/avatar-images/short-{A,B}.png at commit 58c9752e.
uv run --no-project python tooling/avatar-layers/jobs.py $W > $W/joblist   # writes gen/<job>.prompt
# Generate the two bases first, then every other job (about 5–10 minutes each, run 6 at a time).
# Headbands (band-<hair>-*) edit their hair sheet, so they go last.
grep '^base' $W/joblist | xargs -n2 -P2 tooling/avatar-layers/run.sh $W
grep -v '^base\|^band' $W/joblist | xargs -n2 -P6 tooling/avatar-layers/run.sh $W
grep '^band' $W/joblist | xargs -n2 -P6 tooling/avatar-layers/run.sh $W
PY="uv run --no-project --with pillow --with numpy --with scipy --with opencv-python-headless python"
for f in $W/gen/*.png; do $PY tooling/avatar-layers/key.py $f $W/cut/$(basename $f); done
$PY tooling/avatar-layers/build.py $W packages/game/assets/avatar-layers packages/game/src/avatar-layers.json
node tooling/avatar-layers/mobile-sources.mjs                    # Metro require table
```

- `run.sh` runs one Codex `image_gen` edit. Pass the prompt on stdin, because a positional prompt after `--image` is read as another image.
- `key.py` removes the magenta background with binary alpha and recolours magenta spill on the edges to the outline colour.
- `build.py` works on each pose figure:
  1. Aligns the edit to the base (ECC on tones, falling back to the silhouette).
  2. Keeps only the pixels that changed, plus the outlines bridging them.
  3. Splits those pixels by colour into skin, tintable materials and fixed-colour parts.
     Hair below the kit collar goes to `hair-<style>-back`, drawn behind the body. A headband is cut against its own hair sheet, so it wraps that hairstyle. `band-bald` is cut against the base, because `bald` has no hair layer.
  4. Downscales each layer by `SCALE` (0.6), keeping its parts gap-free.
  5. Packs one atlas per pose.
- `preview.py` composites layers the way the renderer does, for checking a build:

  ```sh
  $PY tooling/avatar-layers/preview.py <atlas dir> <data json> out.png "poses=runL,stand;layers=kit,hair-afro;hair=6e4428"
  ```

Check every hairstyle, outfit and accessory in all 18 poses before replacing the committed atlases. image_gen sometimes moves a limb or misses a figure. When that happens, delete `gen/<job>.png` and run that job again.

A figure that stays unchanged after a rerun is too small for image_gen. Crop that figure from `gen/base-<sheet>.png`, enlarge it 3× (nearest), edit the crop alone, shrink it back, key it and paste it over the same window of `cut/<job>-<sheet>.png`. The runL figure of `expr-wink-A` was made this way with `wink-fix.prompt` (window x 47–329, y 0–401 of sheet A).
