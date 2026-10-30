import type { Translation } from '../core';
import type { RevealMsgs } from '../ko/reveal';

export const reveal: Translation<RevealMsgs> = {
  skip: 'Tap to skip',
  shortTitle: 'Short reveals',
  shortBody:
    'Show candidate and potential results right away, without the reveal animation. Results are the same.',
  good: 'Great pull',
  jackpot: 'Jackpot',
  gradeLive: (p) => (p.tier ? `${p.tier}! ${p.text}` : p.text),
  candLive: (p) => `${p.tier ? `${p.tier}! ` : ''}Candidate ${p.n}, OVR ${p.ovr}`,
};
