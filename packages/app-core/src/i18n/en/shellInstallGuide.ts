import type { Translation } from '../core';
import type { ShellInstallGuideMsgs } from '../ko/shellInstallGuide';

export const shellInstallGuide: Translation<ShellInstallGuideMsgs> = {
  installTitle: 'Add to your home screen and open it like an app',
  installInapp:
    'You need to open this in a regular browser (Safari or Chrome) to add it to your home screen.',
  installBody:
    'Open OFFSIDE straight from its home screen icon. You can see this guide again in Settings > Help.',
  optOut: "Don't show again",
  stepIosChrome1: 'Tap the Share button on the right of the address bar.',
  stepIosChrome2: "Tap 'More' at the far right of the bottom row.",
  stepIosChrome3: "Choose 'Add to Home Screen' from the list.",
  stepIosChrome4: "Tap 'Add' at the top right and you're done.",
  stepIosSafari1: 'Tap the Share button at the bottom of the screen (or next to the address bar).',
  stepIosSafari2: "Choose 'Add to Home Screen' from the list.",
  stepIosSafari3: "Tap 'Add' at the top right and you're done.",
  stepAndroid1: 'Tap the ⋮ menu at the top right.',
  stepAndroid2: "Choose 'Add to Home screen'.",
  stepAndroid3: "Tap 'Add' and you're done.",
  stepOther1: 'Open offside-lab.com in your phone browser.',
  stepOther2: "From the Share button (or ⋮ menu), choose 'Add to Home Screen'.",
  stepOther3: "Tap 'Add' and you're done.",
};
