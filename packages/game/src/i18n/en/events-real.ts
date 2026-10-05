// 이벤트 영어 문구 — 정의 모듈의 이벤트 id → 문구(events-data.ts EventText).
import type { EventText } from '../../events-data';
import type { Pos } from '../../data';
import { isKorean } from '../../nation';
import { pick } from '../../rng';
import { leagueOf } from '../../player';
import type { GameState } from '../../types';
import { tn } from '../names';

const byPos =
  <T>(m: Partial<Record<Pos | 'def', T>>) =>
  (s: GameState): T =>
    (m[s.pos] ?? m.def) as T;

// realevents.ts 의 DERBY — 리그 id → 더비 이름(영어).
const DERBY: Record<string, string> = {
  k2: 'Gyeongin Derby',
  k1: 'East Coast Derby',
  j1: 'Tamagawa Clasico',
  mls: 'El Trafico',
  ere: 'De Klassieker',
  l1: 'Le Classique',
  bl: 'Der Klassiker',
  sa: 'Milan derby',
  ll: 'El Clasico',
  pl: 'Manchester derby',
};

// realevents.ts 의 CAMP 와 같은 조건에서 같은 개수의 후보 중 pick 한 번 — 한국어와 같은 난수를 같은 만큼 쓴다.
const camp = (s: GameState): string =>
  s.leagueId === 'mls'
    ? pick(['Florida, USA', 'Arizona, USA', 'Cancun, Mexico'])
    : leagueOf(s.leagueId).tier <= 3
      ? pick(['Antalya, Turkey', 'Chiang Mai, Thailand', 'Kagoshima, Japan', 'Seogwipo, Jeju'])
      : pick(['Marbella, Spain', 'Dubai, UAE', 'Florida, USA']);

// releaseEvent(아시안게임·올림픽 차출 협상)의 공통 문구 틀.
function release(o: {
  title: string;
  text: string;
  mil: string;
  rest: string;
  blessing: string;
  refusal: string;
  missed: string;
}): EventText {
  return {
    title: o.title,
    text: (s) => (isKorean(s) ? [o.text, o.mil, o.rest] : [o.text, o.rest]).join(' '),
    choices: [
      {
        label: 'Take it straight to the club hierarchy',
        ok: o.blessing,
        fail: o.refusal,
      },
      {
        label: 'Trade a contract extension for a release',
        ok: 'The club agreed to release you if you extend your contract by a year with no pay rise.',
        fail: o.missed,
      },
      {
        label: 'Stay and focus on the season',
        ok: 'Your manager is grateful for the decision.',
      },
    ],
  };
}

export const events_real: Record<string, EventText> = {
  var: {
    title: 'VAR pitchside review',
    text: byPos<string>({
      FW: 'Your shot looked like the winner. The referee puts a hand to his ear and jogs to the monitor. The offside lines are being drawn.',
      MF: 'Your long-range strike ripples the net. But the referee heads for the monitor to check for a handball in the build-up.',
      DF: 'An opponent goes down under your tackle in the box. The referee runs to the monitor for a pitchside review.',
      GK: 'One-on-one, you throw yourself down and smother the ball, but the striker goes over. The referee checks the monitor for a penalty.',
    }),
    choices: [
      {
        label: 'Protest hard to the referee',
        ok: byPos<string>({
          FW: 'The goal stands! You won the mind games too, and your teammates rally round you.',
          MF: 'The goal stands! You won the mind games too, and your teammates rally round you.',
          def: 'No penalty! You got the ball first. You did not back down in the mind games either.',
        }),
        fail: byPos<string>({
          FW: 'The goal is chalked off and you get a yellow card on top. Your manager shakes his head on the bench.',
          MF: 'The goal is chalked off and you get a yellow card on top. Your manager shakes his head on the bench.',
          def: 'Penalty given, and a yellow card for dissent. Your manager shakes his head on the bench.',
        }),
      },
      {
        label: 'Hold your hands together and wait',
        ok: byPos<string>({
          FW: '"GOAL!" flashes on the board after the VAR check. You get to celebrate it twice.',
          MF: '"GOAL!" flashes on the board after the VAR check. You get to celebrate it twice.',
          def: '"NO PENALTY" appears on the board and the home crowd roars. A clean tackle.',
        }),
        fail: byPos<string>({
          FW: 'Offside by a shoulder. You calmly get ready for the next play.',
          MF: 'Handball confirmed, goal ruled out. You calmly get ready for the next play.',
          DF: 'Penalty awarded. You hang your head, then get ready for the next play.',
          GK: 'Penalty awarded. Now you have to face the taker.',
        }),
      },
    ],
  },
  racism: {
    title: 'Racist abuse in the away end',
    text: () =>
      'During an away match, you hear racist gestures and chants aimed at Asians from the stands. Your teammates gather around you.',
    choices: [
      {
        label: 'Tell the referee and ask for the anti-racism protocol',
        ok: 'The match is paused and a warning is read out over the tannoy. The club and the league issue official statements backing you.',
      },
      {
        label: 'Answer with your football',
        ok: byPos<string>({
          FW: 'You score and quietly point to the badge on your chest. Your name comes up among fans abroad too.',
          MF: 'You set up the winner and quietly point to the badge on your chest. Your name comes up among fans abroad too.',
          DF: 'You finish with a clean sheet and quietly point to the badge. Your name comes up among fans abroad too.',
          GK: 'You make save after save, then quietly point to the badge. Your name comes up among fans abroad too.',
        }),
        fail: 'Your mind was elsewhere for the full 90 minutes. Your teammates stayed by your side to the end.',
      },
    ],
  },
  'winter-window': {
    title: 'January transfer window',
    text: (s) =>
      `The January window is open. Reports say a club from a league a level up has made an official enquiry to ${tn(s.club.name)}. The club's line is "no mid-season sales".`,
    choices: [
      {
        label: 'Ask the club for a transfer',
        ok: 'The club promised a summer move. A bigger stage awaits once this season is over.',
        fail: 'The club turned you down, and the transfer request leaked to the press. The home fans have started to jeer.',
      },
      {
        label: 'Say "I\'m staying to win trophies"',
        ok: 'The fans chant your name. Your manager trusts you even more.',
      },
    ],
  },
  'ag-release': release({
    title: 'Asian Games release talks',
    text: 'The Asian Games squad wants you.',
    mil: 'A gold medal means exemption from military service.',
    rest: 'But the Asian Games are not a mandatory FIFA release window, so you need your club to agree to let you go mid-season.',
    blessing: '"Bring back the gold." The club agreed to release you.',
    refusal: 'The club refused, saying it cannot lose a regular starter in mid-season.',
    missed: 'Talks broke down. You will be watching this Asian Games on TV.',
  }),
  'oly-release': release({
    title: 'Olympics release talks',
    text: 'The Olympic squad wants you.',
    mil: 'A bronze medal or better means exemption from military service.',
    rest: "But Olympic men's football is not a mandatory FIFA release window either, so you need your club to agree to a release that clashes with pre-season.",
    blessing: '"Bring back a medal." The club agreed to release you.',
    refusal: 'The club refused, saying you cannot miss preparations for the new season.',
    missed: 'Talks broke down. You will be watching this Olympics on TV.',
  }),
  puskas: {
    title: 'Wonder goal, Puskas Award nominee',
    text: () =>
      'Your volley from 35 metres out found the corner of the net. FIFA has shortlisted the goal for the Puskas Award. The winner is decided by fan and expert votes.',
    choices: [
      {
        label: 'Rally fan votes on social media',
        ok: 'FIFA Puskas Award winner! Your goal has been chosen as the most beautiful of the year.',
        fail: 'You missed out, and the heavy vote-chasing drew some criticism. Still, the clip has passed millions of views.',
      },
      {
        label: '"It was down to my teammates"',
        ok: 'Your humble words got people talking. The mood in the dressing room is even better.',
      },
    ],
  },
  'winter-camp': {
    title: 'Winter training camp',
    text: (s) =>
      `A three-week training camp begins in ${camp(s)}. It is the time of year when the coaching staff finalise their plans for the season.`,
    choices: [
      {
        label: 'Aim to top the fitness tests',
        ok: 'First in the bleep test. The coaches mark you "excellent" on the assessment sheet.',
        fail: 'You pushed too hard and felt pain in your calf. You spent the end of camp in rehab.',
      },
      {
        label: 'Focus on the tactical meetings',
        ok: 'You picked up the new tactics faster than anyone.',
      },
    ],
  },
  'team-k': {
    title: 'Selected for Team K League',
    text: () =>
      'Fan votes have put you in the Team K League squad! In midsummer you take on a visiting European giant in a friendly at Seoul World Cup Stadium.',
    choices: [
      {
        label: 'Give everything in front of the European scouts',
        ok: byPos<string>({
          FW: "A wonder goal rattled the big club's defence. After the match, the opposing manager asked who you were.",
          MF: 'You shrugged off the press in a midfield full of world-class players. After the match, the opposing manager asked who you were.',
          DF: 'You shut down a world-class striker. After the match, the opposing manager asked who you were.',
          GK: "You kept out shot after shot from the big club's attack. After the match, the opposing manager asked who you were.",
        }),
        fail: 'You felt the gap to world level first-hand. Overdoing it has left your body heavy too.',
      },
      {
        label: 'Enjoy the occasion',
        ok: 'A midsummer friendly spent mixing with the fans. You returned to your club injury-free, and your manager breathed a sigh of relief.',
      },
    ],
  },
  derby: {
    title: 'Rivalry derby',
    text: (s) =>
      `${DERBY[s.leagueId]}. The whole city has been buzzing all week. The atmosphere in the stadium is unlike any other day.`,
    choices: [
      {
        label: byPos<string>({
          FW: 'Score and celebrate in front of the away end',
          MF: 'Dominate the game and celebrate in front of the away end',
          DF: 'Shut out their star player and taunt the away end',
          GK: 'Keep a clean sheet and roar at the away end',
        }),
        ok: byPos<string>({
          FW: 'A derby-winning goal! The away end fell silent, and the home fans sang your name at the top of their voices.',
          MF: 'You assisted the derby winner! The home fans sang your name at the top of their voices.',
          DF: 'Their star player did not have a single shot in a comfortable win. The home fans chant your name.',
          GK: 'A derby clean sheet, with a penalty save to boot! The home fans chant your name.',
        }),
        fail: 'A defeat. The rival fans mock your pre-match bravado.',
      },
      {
        label: 'Focus on managing the game',
        ok: 'You kept a cool head for 90 minutes. Your manager is pleased.',
      },
    ],
  },
  'asia-tour': {
    title: 'Pre-season Asia tour',
    text: (s) =>
      `${tn(s.club.name)} are playing their pre-season Asia tour in Seoul. Most of the 60,000 crowd are wearing your shirt.`,
    choices: [
      {
        label: 'Do every signing session and event',
        ok: "The cheers followed you from the airport to the stadium. Your shirt is the club's top seller, and the board is delighted.",
      },
      {
        label: 'Focus on staying fit',
        ok: 'You said a quick hello and got on with training.',
      },
    ],
  },
};
