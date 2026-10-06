// 이벤트 영어 문구 — 정의 모듈의 이벤트 id → 문구(events-data.ts EventText).
import type { EventText } from '../../events-data';
import type { Pos } from '../../data';
import { agentFee, fmtMoney, labelOf, weakKey } from '../../engine';
import { rivalName as rivalKo } from '../../stories';
import type { GameState, StoryState } from '../../types';
import { personName, tn } from '../names';

const byPos =
  <T>(m: Partial<Record<Pos | 'def', T>>) =>
  (s: GameState): T =>
    (m[s.pos] ?? m.def) as T;

const POS_EN: Record<Pos, string> = {
  FW: 'striker',
  MF: 'midfielder',
  DF: 'defender',
  GK: 'goalkeeper',
};

/** 라이벌 이름은 stories.ts rivalName이 정해 저장한다(같은 난수). 화면에는 로마자 표기로 보여 준다. */
const rivalName = (s: GameState): string => personName(rivalKo(s));
const rv = (s: GameState) => s.story.rival as StoryState & { gap: number; tone: string };

export const events_story: Record<string, EventText> = {
  'rival-1': {
    title: 'A rival your age appears',
    text: (s) =>
      `Same age, same position: ${POS_EN[s.pos]}. The press has started to pick up on your rivalry with ${rivalName(s)}.`,
    choices: [
      {
        label: 'Declare war in public',
        ok: 'Headline: "Who is better? You will find out soon." The fire is lit.',
      },
      {
        label: 'Let your football do the talking',
        ok: 'You kept quiet. Instead, the training ground lights are the last to go out.',
      },
    ],
  },
  'rival-2': {
    title: 'The showdown',
    text: (s) =>
      `The day you take on ${rivalName(s)}. ${rv(s).tone === 'loud' ? 'It is the first meeting since you declared war, and the stadium is sold out.' : 'It is the first official meeting between the two of you.'}`,
    choices: [
      {
        label: byPos<string>({
          FW: 'Go for a head-on one-on-one',
          MF: 'Go head-to-head in midfield',
          DF: 'Volunteer to mark your rival man-for-man',
          GK: 'Vow to win the shot-stopping duel',
        }),
        ok: 'A comfortable win. In the post-match interviews, reporters only called your name.',
        fail: byPos<string>({
          FW: 'Your rival scored the winner. The walk to the bench felt very long.',
          MF: "You lost the midfield battle. Your rival's killer pass led to the winner.",
          DF: 'Your rival got past you and scored the winner. The highlights catch only your back as he goes by.',
          GK: 'Your rival kept a clean sheet and you conceded twice. The comparison articles are pouring out.',
        }),
      },
      {
        label: 'Stick to the team tactics',
        ok: 'The personal duel ended level. Your manager thought highly of your judgment.',
      },
    ],
  },
  'rival-3': {
    title: 'One spot on the national team',
    text: (s) =>
      `The national team has room for just one ${POS_EN[s.pos]}. ${rv(s).gap <= 0 ? 'You are now a step ahead.' : `For now, ${rivalName(s)} is still a step ahead.`}`,
    choices: [
      {
        label: 'Compete to the end',
        ok: 'The starting bib was yours. Competing has lifted your game a level too.',
        fail: 'Once again you lost out by a whisker. In training, you keep noticing only what you lack.',
      },
      {
        label: 'Offer your hand first',
        ok: '"I got here because of you." The two of you became national team roommates and trained together, each absorbing the other\'s strengths.',
        fail: 'The outstretched hand hung awkwardly in the air. Only whispers remain that you ducked the competition.',
      },
    ],
  },
  'rehab-1': {
    title: 'Long-term injury diagnosis',
    text: (s) =>
      `The detailed scan results are in. You will miss at least ${s.injury} matches. The medical staff lay out two options.`,
    choices: [
      {
        label: 'Have the surgery',
        ok: 'The surgery went well. You will be back later, but the risk of a re-injury is lower. The club welcomed the long-term decision.',
      },
      {
        label: 'Go with conservative treatment',
        ok: 'Recovery is faster than expected.',
        fail: 'The pain will not go away. Your time out has been extended.',
      },
    ],
  },
  'rehab-2': {
    title: 'The rehab wall',
    text: (s) =>
      `Every day at the rehab center drags. The team is playing without you.${s.injury ? ` You have ${s.injury} matches left to miss.` : ''}`,
    choices: [
      {
        label: 'Force an early return',
        ok: "Defying the medical staff's forecast, you are back on the training pitch.",
        fail: 'You rushed it. The pain came back in the same spot.',
      },
      {
        label: 'Come back only once fully recovered',
        ok: 'You even finished your upper-body weights program during rehab. Your body is stronger than before.',
      },
    ],
  },
  'rehab-3': {
    title: 'The comeback match',
    text: () => 'The stands chant your name. It is your first match since the injury.',
    choices: [
      {
        label: byPos<string>({
          FW: 'Prove yourself with a comeback goal',
          MF: 'Prove yourself with a goal or assist on your return',
          DF: 'Prove yourself with a clean sheet at the back',
          GK: 'Prove yourself with a clean sheet',
        }),
        ok: 'A picture-perfect return. The local press wrote "back stronger".',
        fail: byPos<string>({
          FW: 'No goal, but you played to the end without a knock.',
          MF: 'No goal, but you played to the end without a knock.',
          DF: 'You conceded a goal, but you played to the end without a knock.',
          GK: 'You conceded, but you stayed in goal to the end without a knock.',
        }),
      },
      {
        label: 'Ease back into it slowly',
        ok: 'You did not overdo it. You are raising the training intensity gradually and getting your match sharpness back.',
      },
    ],
  },
  'scandal-2': {
    title: 'Scandal fallout',
    text: () =>
      "The early-morning photo story has been on the news portal's front page for a week. The club's PR team asks how you want to respond.",
    choices: [
      {
        label: 'Apologize publicly at a press conference',
        ok: 'The heartfelt apology is slowly turning public opinion around.',
        fail: 'One word in the apology became a problem, and it backfired.',
      },
      {
        label: 'Ride it out in silence',
        ok: 'It was buried by other news and quietly forgotten. The club welcomed your low profile.',
        fail: 'Your silence was taken as an admission. The club is starting to turn its back on you too.',
      },
    ],
  },
  'scandal-3': {
    title: 'A chance to redeem yourself',
    text: () =>
      'Just as the controversy dies down, an invitation arrives to a charity match for children with cancer.',
    choices: [
      {
        label: 'Play in the charity match',
        ok: 'A photo of you with the children made the papers.',
      },
      {
        label: 'Answer with your performances only',
        ok: 'Goals and assists, week after week. Now nobody mentions that photo.',
        fail: 'When your form dipped, the label stuck: "his private life is to blame".',
      },
    ],
  },
  'europe-2': {
    title: 'A call from an agent',
    text: (s) =>
      `A top agent who specializes in European moves has reached out. His fee is ${fmtMoney(agentFee(s))}.`,
    choices: [
      {
        label: 'Sign with the agent',
        ok: '"You can look forward to the next transfer window." A list of European clubs has arrived.',
      },
      {
        label: 'Keep growing at your current club',
        ok: (s) =>
          s.contract && s.contract.years >= 3
            ? 'You put the European move on hold. The club welcomed the decision to stay.'
            : "You put the European move on hold. But with your contract running down, the club's reaction is lukewarm.",
      },
    ],
  },
  'europe-3': {
    title: 'In a strange land',
    text: (s) =>
      `Your first season at ${tn(s.club.name)}. The language, the food and the weather are all unfamiliar.`,
    choices: [
      {
        label: 'Learn the local language first',
        ok: 'Within three months you could follow the dressing-room banter.',
        fail: 'Language school on top of training left you far too tired.',
      },
      {
        label: 'Communicate through football alone',
        ok: 'Your language is shaky, but your play won everyone over. The manager built the team around you, and the home fans made up a chant for you.',
        fail: 'The isolation keeps growing. Every night you think of food from home.',
      },
    ],
  },
  'mentor-2': {
    title: "The manager's special project",
    text: (s) =>
      `Your manager called you in. "${labelOf(s, weakKey(s))} is your weak spot. Fix that and you become a bigger player."`,
    choices: [
      {
        label: 'Accept the new role',
        ok: 'The part of your game that was called a weakness is starting to work in matches.',
        fail: 'It felt like wearing the wrong clothes. Even so, your manager was patient with you.',
      },
      {
        label: 'Stick to your own style',
        ok: 'You sharpened your strengths further. Your manager nodded without a word.',
      },
    ],
  },
  'mentor-3': {
    title: 'Your mentor moves on',
    text: () =>
      'The manager who developed you is taking charge of another club. The night before he leaves, he calls. "Come with me."',
    choices: [
      {
        label: 'Follow your mentor',
        ok: "In the next transfer window, your mentor's new club will send a formal offer.",
      },
      {
        label: 'Stay and hold the team together',
        ok: "A new manager is coming, but the club has handed you the vice-captain's armband for staying. The fans will remember that you stayed.",
      },
    ],
  },
};
