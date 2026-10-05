import type { Translation } from '../core';
import type { AppScoutMsgs } from '../ko/appScout';

const POOLS: Record<string, readonly string[]> = {
  earlyHigh: [
    "This kid is something special. Develop him properly and he'll hold his own on the big stage.",
    'He has the most room to grow of anyone his age.',
    "Put a star next to him in the report. You don't see many like him.",
    "At this rate he'll make a name for himself within a few years.",
  ],
  earlyMid: [
    "He'll definitely grow into a top-flight player. What comes after is up to him.",
    'Too early to say. The next two or three seasons will tell.',
    'He can fight for a starting spot if he builds one real weapon.',
    "Nothing flashy, but the basics are sound. Polish him up and he'll be useful.",
  ],
  earlyLow: [
    "Not a player who'll win on talent alone. But if he stays consistent, he'll last.",
    'Not glamorous. But players like this last a long time.',
    "His work rate is a given. That's his weapon.",
    'For now, he needs to play plenty of matches and gain experience.',
  ],
  lateS: [
    "A talent that comes along once in a blue moon. One of the best I've seen in my career.",
    'This one belongs on the biggest stage in the world.',
    "I've never seen this much potential in one generation.",
  ],
  lateA: [
    "He'll do well in the big leagues.",
    'He could even become the face of his league.',
    'He has what it takes to be a key player for a top club.',
  ],
  lateB: [
    'A top-flight starter. No doubt about it.',
    'The kind of player any manager would trust to start.',
    "He'll find his place at whichever club he joins.",
  ],
  lateC: [
    'Depending on how he develops, he could push for a starting spot.',
    "He'll do his bit in the rotation.",
    'Take his chances and he can move up another level.',
  ],
  lateD: [
    "He'll rely on consistency more than talent.",
    'The type who holds his place through hard work. That counts as talent too.',
    "He'll get by on experience and play for a long time.",
  ],
};

export const appScout: Translation<AppScoutMsgs> = {
  hint: (p) => POOLS[p.pool]![p.i]!,
};
