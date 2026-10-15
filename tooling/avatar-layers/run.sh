#!/bin/zsh
# run.sh <work dir> <job> <sheet> — one Codex image_gen edit, skipped when gen/<job>.png exists.
# base-* jobs edit ref/short-<sheet>.png, band-<hair>-* edit that hair sheet, every other job edits gen/base-<sheet>.png.
W=${1:A}; cd $W
[ -f gen/$2.png ] && { echo "skip $2"; exit 0; }
if [[ $2 == base-* ]]; then IN=ref/short-$3.png
elif [[ $2 == band-bald-* ]]; then IN=gen/base-$3.png               # bald has no hair layer
elif [[ $2 == band-* ]]; then IN=gen/hair-${${2#band-}%-*}-$3.png   # band-afro-A edits gen/hair-afro-A.png
else IN=gen/base-$3.png; fi
# The prompt goes on stdin: a positional prompt after --image is read as another image path.
codex exec --skip-git-repo-check -s workspace-write -C $W --image $IN -- - < gen/$2.prompt > gen/$2.log 2>&1
[ -f gen/$2.png ] && echo "done $2" || echo "FAIL $2"
