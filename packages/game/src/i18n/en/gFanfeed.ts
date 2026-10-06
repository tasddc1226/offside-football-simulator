import type { Translation } from '@offside/contracts/i18n';
import type { GFanfeedMsgs } from '../ko/gFanfeed';

const lines = (...a: string[]) => a.join('\n');

export const gFanfeed: Translation<GFanfeedMsgs> = {
  rating_high: lines(
    "Couldn't believe my eyes when I saw the match rating.",
    'His form lately is unreal.',
    'My heart skips every time the ratings update.',
    'Find of the season, surely?',
    'Watched the highlights three times after the match.',
    "The numbers don't lie. He's in the zone.",
  ),
  rating_low: lines(
    "A bit of a letdown today, but there's another match.",
    'Off day maybe? Still believe in him.',
    'Everyone has days like this. Still behind him.',
    'Rating was low, but you can see the commitment.',
    "Every player goes through a slump. He'll bounce back soon.",
  ),
  goals_high: lines(
    'Could he be in the race for the Golden Boot this season?',
    "The way he scores, he's got a real knack for it.",
    "Already this many goals? That's crazy.",
    'His finishing is up there with the best in the league.',
    'The goal celebrations have become a joy to watch.',
  ),
  assists_high: lines(
    'Assist king in the making.',
    'You can see him reading the game with every pass.',
    'The way he sets up teammates really helps the side.',
    'Used to seeing his name on the assists table now.',
    'His eye for a pass has definitely got better.',
  ),
  cs_high: lines(
    'A solid back line and the whole team feels steady.',
    'All those clean sheets build real trust.',
    'Watching him organize the defense, he looks every bit a pro.',
    'With this many clean sheets, he is a contender for best goalkeeper.',
    'One change in goal and the whole mood has shifted.',
  ),
  rank_champion: lines(
    "Champions! I've waited so many years for this moment.",
    'Screenshotted the trophy lift and saved it.',
    'This is all I needed from this season.',
    "Still can't believe we're on top.",
    'My hands are still shaking.',
  ),
  rank_mid: lines(
    'Mid-table, but not a bad season.',
    'Hoping we go one step higher next year.',
    'Glad we finished the season steady.',
    'A season that passed without any drama.',
    "Let's call it a season of building a base.",
  ),
  rank_low: lines(
    "A tough season, but I'm with you to the end.",
    "We may have dropped, but the fans haven't. See you next year.",
    "Let's forget this season and get ready again.",
    'The league table is disappointing, but he gave his all.',
    "We've hit rock bottom, so the only way is up.",
  ),
  role_main: lines(
    "He's a regular starter now.",
    "You can feel the manager's full trust.",
    'His name is in the lineup every match, so I feel at ease.',
    'Breaking into the starting XI is impressive.',
    "You can see he's grown into a key player.",
  ),
  role_bench: lines(
    'Shame about the minutes, but his chance will come.',
    'Good to see him quietly preparing from the bench.',
    'Hang in there a bit longer and your chance will come.',
    'You can feel him giving everything every time he comes on.',
    "He'll break through one day. I'll keep watching.",
  ),
  trophy: lines(
    'Got goosebumps the moment I heard about the trophy.',
    'Another trophy on his CV.',
    "Proof that he's indispensable to the team.",
    'This is why I bought a season ticket.',
  ),
  injury: lines(
    'Was really worried when I heard about the injury.',
    "Don't rush it. Come back when you're fully fit.",
    'Waiting for your quick return.',
    'Looking after your body matters most, so take it slowly.',
  ),
  transfer: lines(
    "Strange to see him in the new jersey, but I'm behind him.",
    'Fans are fired up about the transfer news.',
    'Do well at the new club too. You just need to settle in.',
    "Sad to see him go, but it's a step up to a bigger stage.",
  ),
  general: lines(
    'Thanks for giving it everything all season again.',
    "Buying next season's jersey with his name on it.",
    'When I go to the stadium, his name is the first I look for.',
    'You can see him grow every season, which makes it fun to watch.',
    'Come back in good shape after the offseason.',
    'Wherever you play, the support goes on.',
  ),
  milestone: lines(
    'Another record broken. Brilliant.',
    'Another line added to the career.',
    "At this rate he's heading for legend status.",
    'Seeing it in numbers, you realize how special it is.',
  ),
};
