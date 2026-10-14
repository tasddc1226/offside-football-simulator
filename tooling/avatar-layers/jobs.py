"""Writes <work>/gen/<job>.prompt for the two base sheets and every layer edit.

usage: jobs.py <work dir> > <work dir>/joblist   (lines: "<job> <sheet>")
The base jobs edit ref/short-{A,B}.png, every other job edits gen/base-<sheet>.png.
"""
import os, sys
P = sys.argv[1]
os.makedirs(f'{P}/gen', exist_ok=True)
N = {'A': 'TEN', 'B': 'EIGHT'}
KEEP_CLOTHES = 'Do not change the clothing (white undershirt and white shorts stay) and keep the feet bare.'
KEEP_BALD = 'Keep every head completely BALD and the faces unchanged.'
HAIR = {
    'short': 'a short tidy crop with faded sides',
    'fringe': 'side-swept long fringe with natural chunky locks',
    'long': 'shoulder-length dark wavy hair with a thin plain white headband',
    'mohawk': 'a compact upright mohawk with close-cropped sides',
    'slick': 'neatly slicked-back hair',
    'buzz': 'a very short athletic buzz cut',
    'afro': 'a round tight curly afro of modest natural volume',
    'bun': 'hair tied in a compact top knot bun',
    'spiky': 'short messy spiky hair',
}
EXPR = {
    'happy': 'a happy relaxed wide smile with open eyes',
    'wink': 'winking the viewer-right eye with a subtle smile',
    'pain': 'a pained expression with eyes squeezed shut and gritted teeth',
    'tired': 'tired half-lidded eyes with a flat mouth',
    'blink': 'both eyes gently closed (a blink) with a calm small smile',
    'shout': 'shouting with a wide open mouth and determined eyes',
}
jobs = {}
for s in 'AB':
    for k, v in HAIR.items():
        jobs[f'hair-{k}-{s}'] = (s, f'Add hair to every figure: {v}, dark charcoal hair with slate highlights, sitting naturally on the bald scalp with a crisp dark outline. Faces, eyebrows and ears stay as they are where the hair does not cover them. Hair stays behind raised arms and hands. {KEEP_CLOTHES}')
    jobs[f'kit-{s}'] = (s, f'Dress every figure in a football kit drawn over the body: teal short-sleeve jersey with a white V collar and white sleeve trims, navy shorts, mustard yellow socks up to below the knee, black football boots with grey soles. Sleeves and shorts may be slightly larger than the white base clothes so they fully cover them. Arms, hands and legs keep their exact positions. {KEEP_BALD}')
    jobs[f'army-{s}'] = (s, f'Dress every figure in a military training uniform drawn over the body: long-sleeve olive woodland camouflage shirt, full-length matching camouflage trousers, charcoal combat boots. Hands stay visible. Arms and legs keep their exact positions. {KEEP_BALD}')
    for k, v in EXPR.items():
        jobs[f'expr-{k}-{s}'] = (s, f'Change ONLY the facial expression of every figure to {v}. Eyebrows may follow the expression. Keep every head completely BALD and keep the clothing, body and pose identical.')
    jobs[f'beard-stubble-{s}'] = (s, f'Add a light short stubble beard to every figure along the jaw, chin and upper lip, dark charcoal. Keep the mouth, eyes and expression identical. {KEEP_BALD.replace(" and the faces unchanged", "")} {KEEP_CLOTHES}')
    jobs[f'beard-full-{s}'] = (s, f'Add a short neat FULL beard to every figure covering the jaw, chin, cheeks below the ears and the upper lip, dark charcoal with a crisp outline. The mouth stays visible. Keep eyes and expression identical. {KEEP_BALD.replace(" and the faces unchanged", "")} {KEEP_CLOTHES}')
    jobs[f'acc-goggles-{s}'] = (s, f'Add sports goggles over the eyes of every figure: a solid BLACK frame and strap around the head, and PALE LIGHT-GREY glass lenses (clearly lighter than the frame) through which the eyes are not visible. Nothing else changes. Keep every head BALD. {KEEP_CLOTHES}')
    jobs[f'acc-wrist-{s}'] = (s, f'Add a plain WHITE sweatband on both wrists of every figure. Hands and arms keep their exact positions. Nothing else changes. {KEEP_BALD} {KEEP_CLOTHES}')
    jobs[f'acc-armband-{s}'] = (s, f'Add a yellow captain armband around the upper arm of every figure, over the white sleeve on the arm nearest the viewer-left. Nothing else changes. {KEEP_BALD} {KEEP_CLOTHES}')
STAND = 'Change ONLY the bottom-right standing figure (the last figure); every other figure stays exactly identical.'
jobs['suit-B'] = ('B', f'Dress every figure in a smart dark navy two-piece suit drawn over the body: long-sleeve jacket with lapels, white shirt collar and a dark tie, long trousers, black dress shoes. Hands stay visible. Arms and legs keep their exact positions. {KEEP_BALD}')
jobs['prop-bouquet-B'] = ('B', f'{STAND} That figure holds a small bouquet of colourful flowers in the hand at the viewer-left side, at waist height, without moving the arm. {KEEP_BALD} {KEEP_CLOTHES}')
jobs['prop-crutch-B'] = ('B', f'{STAND} That figure leans on a wooden crutch tucked under the arm at the viewer-left side, the crutch reaching the floor beside the foot, without moving the body, and has a white elastic bandage wrapped around the viewer-right knee. {KEEP_BALD} {KEEP_CLOTHES}')
jobs['acc-bandage-B'] = ('B', f'Add a small white adhesive bandage patch on the forehead of every figure, slightly to the viewer-right. Nothing else changes. {KEEP_BALD} {KEEP_CLOTHES}')
HEAD = 'Use your built-in image generation tool (image_gen) exactly once to EDIT Image 1, then copy the generated PNG to ./gen/{job}.png (create nothing else). Do not write code to draw or modify the image.\n\nImage prompt:\nUse case: precise local edit of a pose sheet for a paper-doll layering system. Image 1 is the BASE BODY sheet of {n} poses of the OFFSIDE mini footballer. The output must keep the SAME canvas size, the SAME {n} figures in the SAME positions, SAME poses and SAME scale, pixel-aligned with Image 1, so the change can be cut out and laid over Image 1. Keep everything not mentioned exactly identical: faces, eyes, eyebrows, ears, skin colour, bodies, arms, hands, legs, poses, thick dark outline, pixel-inspired shading, and the perfectly flat pure magenta (#FF00FF) background (no shadow, floor, text, border or checkerboard).\nChange ONLY this:\n'
BASE = 'Use your built-in image generation tool (image_gen) exactly once to EDIT Image 1, then copy the generated PNG to ./gen/{job}.png (create nothing else). Do not write code to draw or modify the image.\n\n' + 'Image prompt:\nUse case: identity-preserve edit of a pose sheet. Image 1 is a sheet of {n} poses of the same OFFSIDE mini footballer. The output is the BASE BODY sheet of a paper-doll layering system: the SAME canvas size, the SAME {n} figures in the SAME cells, SAME positions, SAME poses, SAME scale and the same limbs, pixel-aligned with Image 1.\nKeep exactly: chibi proportions, every pose, rounded peach face, ears, dark eyebrows, eye shape and spacing, nose, thick crisp dark outline, restrained pixel-inspired shading.\nChange ONLY these, identically on every figure:\n1. COMPLETELY BALD: smooth round peach scalp with a clean dark outline on top of the skull, no hair, no stubble. Eyebrows stay.\n2. Calm neutral face on every figure: eyes open looking forward, small closed-mouth smile. No shouting, no open mouth, no closed eyes, no tears.\n3. Clothing: plain WHITE short-sleeve fitted undershirt and plain WHITE short shorts, no logos, no trims. BAREFOOT with peach feet and dark outline, no socks, no boots.\n4. Remove any ball, prop or effect.\nBackground: perfectly FLAT uniform pure magenta (#FF00FF) filling the whole canvas, also between and around the figures. No gradient, shadow, floor, grid lines, labels, text, border or checkerboard. Figures must not touch each other.\n'
for s in 'AB':
    open(f'{P}/gen/base-{s}.prompt', 'w').write(BASE.format(job=f'base-{s}', n=N[s]))
    print(f'base-{s}', s)
for job, (s, change) in jobs.items():
    open(f'{P}/gen/{job}.prompt', 'w').write(HEAD.format(job=job, n=N[s]) + change + '\n')
    print(job, s)
# Headbands sit on the hair, so each hairstyle gets its own band edit of its hair sheet (run.sh feeds gen/hair-<h>-<s>.png).
ON_HAIR = HEAD.replace('Image 1 is the BASE BODY sheet of {n} poses', 'Image 1 is a sheet of {n} poses')
for h in HAIR:
    for s in 'AB':
        job = f'band-{h}-{s}'
        change = ('Add a plain WHITE sports headband around the forehead of every figure, worn OVER the hair and following the '
                  'round head, as wide as a real sweatband. The hair keeps its style, volume and colour and only bulges a little '
                  'above and below the band. If a figure already wears a thin headband, widen that one instead of adding another. '
                  f'Nothing else changes. {KEEP_CLOTHES}')
        open(f'{P}/gen/{job}.prompt', 'w').write(ON_HAIR.format(job=job, n=N[s]) + change + '\n')
        print(job, s)
