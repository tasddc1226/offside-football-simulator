import type { Translation } from '../core';
import type { EditFileMsgs } from '../ko/editFile';

export const editFile: Translation<EditFileMsgs> = {
  empty: 'Nothing was pasted.',
  link: 'Paste what is inside the file, not a link. Open the file and copy all of it.',
  cut: 'The file text was cut off. Copy everything from the first { to the last }.',
  notFile:
    "This isn't an edit file exported from the game. Open the exported file and copy all of it.",
  wrongNames:
    'This is a competition, award and league name file. Import it under Settings → Rename competitions and awards, change logos.',
  wrongClubs:
    'This is a club name and crest file. Import it under Settings → Club names and crests.',
  pasteHint:
    "Open the exported edit file, copy all of its text and paste it here. A file name or link won't work.",
};
