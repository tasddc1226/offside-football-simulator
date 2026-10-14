import type { Translation } from '../core';
import type { AvatarPngReviewMsgs } from '../ko/avatarPngReview';
export const avatarPngReview: Translation<AvatarPngReviewMsgs> = {
  title: 'The source artwork, in game.',
  intro: 'Original PNG pixels, without dot conversion or face reconstruction.',
  note: 'Local appearance preview. Hair, skin and kit colours are fixed in each source. Career data and saved customisation stay unchanged.',
  artwork: 'Artwork',
  bald: 'Bald',
  shaved: 'Shaved',
  dread: 'Dreadlocks',
  fauxhawk: 'Fauxhawk',
  ponytail: 'Ponytail',
  mullet: 'Two-tone mullet',
  keeper: 'Goalkeeper',
  theme: 'Light / Dark',
  character: 'Character',
  originalSize: 'Original PNG · 144px',
  gameSize: 'Game size · 72px',
  careerSize: 'Career character size',
  cards: 'Player cards',
  cardIntro:
    'The actual PlayerCard component uses the same source for its head-and-shoulders portrait.',
  poses: 'Source poses',
  poseAria: 'Pose',
  standing: 'Standing',
  running: 'Running',
  shooting: 'Shooting',
  poseNote: 'Three original poses. The complete motion animation set is not connected yet.',
  openSource: 'Open unchanged source PNG',
  openGame: 'Open local game with PNG preview',
  footer:
    'The local game link overrides character and card artwork in this tab. All players show the selected concept; per-career saving and recolouring are not connected. Production and the mobile app are unchanged.',
};
