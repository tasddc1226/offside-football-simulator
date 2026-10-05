import type { Translation } from '../core';
import type { AppScoutMsgs } from '../ko/appScout';

const POOLS: Record<string, readonly string[]> = {
  earlyHigh: [
    'This lad is something special. Develop him properly and he will cope on the big stage.',
    'Of his age group, he looks to have the most room to grow.',
    'Put a star next to him in the report. You do not see many like him.',
    'At this rate he will make a name for himself within a few years.',
  ],
  earlyMid: [
    'He will certainly grow into a top-flight player. What comes after is up to him.',
    'Too early to say. The next two or three seasons will tell.',
    'He can fight for a starting place, if he builds one real weapon.',
    'Nothing flashy, but the basics are sound. Polish him up and he will be useful.',
  ],
  earlyLow: [
    'Not a player who will win on talent. But if he stays consistent, he will last.',
    'Not glamorous. But players like this play for a long time.',
    'His work rate is certain. That is his weapon.',
    'For now, he needs to play plenty of matches and gain experience.',
  ],
  lateS: [
    'A talent that comes along once every few years. One of the best I have seen in my career.',
    'This one belongs on the biggest stage in the world.',
    'I have never seen this much potential in a single generation.',
  ],
  lateA: [
    'He will do well in the big leagues.',
    'He could even become the face of his league.',
    'He has what it takes to play a key role for a top side.',
  ],
  lateB: [
    'A top-flight starter. No doubt about that.',
    'The kind of player any manager would trust with a shirt.',
    'He will find his place at whichever club he joins.',
  ],
  lateC: [
    'Depending on how he goes, he could push for a starting place.',
    'He will do his bit in the rotation.',
    'Grab his chances and he can move up another level.',
  ],
  lateD: [
    'He will rely on consistency more than talent.',
    'The type who holds his place through hard work. That counts as talent too.',
    'He will get by on experience, and play for a long time.',
  ],
};

export const appScout: Translation<AppScoutMsgs> = {
  hint: (p) => POOLS[p.pool]![p.i]!,
};
