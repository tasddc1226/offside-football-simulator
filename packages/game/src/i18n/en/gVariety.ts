import type { Translation } from '@offside/contracts/i18n';
import type { gVarietyText } from '../ko/gVariety';
// derby.ts DERBY_PAIRS와 같은 순서의 더비 이름(리그 id → 이름 목록).
const DERBY_NAMES: Record<string, string[]> = {
  k2: ['Suwon Derby', 'Nakdong River Derby', 'Chungcheong Derby', 'South Coast Derby'],
  k1: ['East Coast Derby', 'Title Derby', 'Hometown Derby', 'Gyeongin Derby'],
  j1: ['Tamagawa Clasico', 'Osaka Derby', 'Tokyo Derby', 'National Derby'],
  mls: ['El Trafico', 'Hudson River Derby', 'Cascadia Derby', 'Texas Derby'],
  ere: ['De Klassieker', 'De Topper', 'Rotterdam Derby', 'Derby of the North'],
  l1: ['Le Classique', 'Paris Derby', 'Derby du Nord', "Côte d'Azur Derby"],
  bl: ['Der Klassiker', 'Hamburg Derby', 'Rhine Derby', 'Nordderby'],
  sa: ['Milan Derby', 'Rome Derby', 'Turin Derby', "Derby d'Italia"],
  ll: ['El Clasico', 'Madrid Derby', 'Seville Derby', 'Basque Derby'],
  pl: ['Manchester Derby', 'Merseyside Derby', 'North London Derby', 'North West Derby'],
  csl: ['Shanghai Derby', 'Qingdao Derby', 'Jing-Jin Derby', 'Jing-Hu Derby'],
  spl: ['Riyadh Derby', 'Jeddah Derby', 'Saudi Clasico'],
  bra: ['Fla-Flu', 'Gre-Nal', 'Derby Paulista', 'Clássico Mineiro'],
  por: ['O Clássico', 'Lisbon Derby', 'Minho Derby', 'Northern Derby'],
};

export const gVariety: Translation<typeof gVarietyText> = {
  derbyName: (p) => DERBY_NAMES[p.league]?.[p.k] ?? '',
  derbyText: (p) =>
    `${p.name} against ${p.opp}. The whole city has been buzzing all week. The atmosphere in the stadium is unlike any other day.`,
  rivalText: (p) =>
    `The rivalry match against ${p.opp}. The whole city has been buzzing all week. The atmosphere in the stadium is unlike any other day.`,

  examTitle: 'Exam week',
  examText:
    'Final exams are a week away. Your homeroom teacher wants you studying, and the coach wants you ready for the weekend league match.',
  examTrainLabel: 'Keep up your evening training',
  examTrainOk:
    'You ran to the pitch the moment you put your pen down. At the weekend match, nobody looked sharper than you.',
  examTrainFail:
    'Training every night left you dozing off in class. Your homeroom teacher called the coach.',
  examStudyLabel: 'Focus on studying',
  examStudyOk:
    'You crammed your way through the exams. You played the weekend match on legs rested for three days.',

  seniorTitle: 'The seniors’ pecking order',
  seniorText:
    'First-years on the university team fetch balls and do the laundry. Training is over, and a senior tosses you the kit bag again.',
  seniorTalkLabel: 'Raise the chores with the coach',
  seniorTalkOk:
    'The coach gathered the squad and scrapped chores by year. From the next day, your teammates set a water bottle at your spot too.',
  seniorTalkFail:
    '"A first-year with a lot to say." Word got around, and the seniors stopped passing to you.',
  seniorBearLabel: 'Put up with it quietly',
  seniorBearOk:
    'You tidied the kit and stayed late. The fourth-year captain saw it and showed you a few dribbling tricks.',

  captainTitle: 'The captain’s armband',
  captainText: 'The coach calls you over after training. "You’re captain for this tournament."',
  captainTakeLabel: 'Wear the armband and lead the team',
  captainTakeOk:
    'You were the first to shout in the pre-match huddle. The team never fell apart once all tournament.',
  captainTakeFail:
    'The seniors and your classmates pulled in different directions. The team drifted through the opening match and lost.',
  captainDeclineLabel: 'Decline to focus on your game',
  captainDeclineOk:
    'The armband went to a senior. You spent the match looking only for passing lanes.',

  friendlyTitle: 'Friendly against a pro reserve side',
  friendlyText:
    'A pro club’s reserve team has come for a friendly. On their bench, the club’s coaches sit with notebooks open.',
  friendlyBoldLabel: 'Take on the pro defenders with confidence',
  friendlyBoldOk:
    'You beat two pros in a row and created the big chance of the match. Afterwards, their coach asked for your shirt number.',
  friendlyBoldFail:
    'You lost almost every physical duel. You saw the gap to the pros up close on the pitch.',
  friendlySafeLabel: 'Keep it simple and avoid mistakes',
  friendlySafeOk:
    'You did not waste a single pass. The coach circled your name on the match sheet.',

  parentsTitle: 'Dinner with your parents',
  parentsText:
    'At the dinner table, your father asks carefully. "How about thinking about university instead of just football?"',
  parentsPersuadeLabel: 'Convince them you will go all in on football',
  parentsPersuadeOk:
    'You talked it through while watching clips from your last match. The next day, your father came home with new boots.',
  parentsPersuadeFail:
    'The conversation ended in silence. The next morning, a cram school flyer was lying on the table.',
  parentsBothLabel: 'Promise to keep studying too',
  parentsBothOk:
    'You studied for an hour after class before heading to training. Your mother packs you an extra lunch box.',

  switchTitle: 'Switching the play',
  switchText:
    'The opponents have crowded toward the ball. On the far side, your winger stands alone with his hand up.',
  switchLongLabel: 'Switch it in one 40m diagonal',
  switchLongOk: 'The ball dropped right at the winger’s feet. He cut inside and scored. An assist!',
  switchLongFail: 'The pass was a touch too long. It ran out for a throw-in and the crowd groaned.',
  switchShortLabel: 'Keep it short and wait for an opening',
  switchShortOk: 'You kept the ball moving with short passes. The manager claps from the bench.',

  tempoTitle: '1-0, ten minutes left',
  tempoText:
    '80 minutes gone, 1-0 up. The manager motions with both hands to calm it down. The opponents have thrown everyone forward.',
  tempoKeepLabel: 'Keep the ball and run down the clock',
  tempoKeepOk: 'The opponents barely touched the ball in the last ten minutes. A 1-0 win.',
  tempoKeepFail: 'Your back pass was short. They equalized in stoppage time.',
  tempoKillLabel: 'Push into the space and go for the second',
  tempoKillOk: 'You ran the counter to the edge of the box and drilled it low. 2-0, game over!',
  tempoKillFail:
    'Your shot was blocked and they countered through the midfield you left. The manager shakes his head.',

  crossTitle: 'A cross from the wing',
  crossText:
    'Your winger has beaten his man. Just before the cross comes in, you see a gap between two defenders.',
  crossNearLabel: 'Attack the near post',
  crossNearOk:
    'You got your head in front of the defender. The ball flew past the keeper’s fingertips into the net.',
  crossNearFail: 'You went a beat too early. The ball sailed over your head.',
  crossFarLabel: 'Wait at the far post',
  crossFarOk: 'The defense all went to the near post. Alone at the far post, you volleyed it in.',
  crossFarFail: 'The cross was short. A defender cleared it first.',

  chaseTitle: 'Pressing the keeper',
  chaseText: 'A defender plays a slow back pass to the keeper. You are 20 meters away.',
  chaseRunLabel: 'Chase it all the way',
  chaseRunOk: 'The keeper’s clearance hit your leg and rolled into the empty net.',
  chaseRunFail: 'You were a step too late. The keeper calmly cleared it out wide.',
  chaseHoldLabel: 'Hold your position and save your legs',
  chaseHoldOk:
    'You held the line and caught your breath. Your legs still felt fresh late in the second half.',

  trapTitle: 'Offside trap',
  trapText:
    'The opponents have put three forwards up top. From the middle of the back line, you have to set how high the line sits.',
  trapUpLabel: 'Step up and spring the trap',
  trapUpOk: 'Up went the assistant’s flag. All three forwards were caught offside at once.',
  trapUpFail:
    'One defender was slow to step up. Their striker went one-on-one with the keeper and scored.',
  trapDropLabel: 'Drop deep and protect the box',
  trapDropOk:
    'You kept it tight in front of the box. They could only shoot from distance until halftime.',

  adviceTitle: 'An offer from a veteran',
  adviceText:
    'The squad’s oldest player stops you after training. "Come in 30 minutes early from tomorrow. I’ll work with you."',
  adviceJoinLabel: 'Train with him every morning',
  adviceJoinOk:
    'For a month you swapped passes with him every morning. Now you check over your shoulder before the ball arrives.',
  adviceJoinFail:
    'Morning sessions on top of team training wore out your legs. You ended up resting for three days.',
  adviceOwnLabel: 'Thank him but do it your own way',
  adviceOwnOk: 'He smiled and patted your shoulder. "Fine. Come to me any time you get stuck."',

  snsTitle: 'Your first wave of hate',
  snsText:
    'Hundreds of abusive comments are piling up under a clip of your mistake last match. The notifications won’t stop.',
  snsReplyLabel: 'Reply yourself after the next match',
  snsReplyOk:
    'You posted a short line with your highlights from the next match. "I’ll do better." Thousands of supportive replies followed.',
  snsReplyFail: 'Screenshots spread the moment you replied. Your name made the headlines.',
  snsOffLabel: 'Delete the app and focus on training',
  snsOffOk:
    'You left your phone in your locker and went to training. You were asleep early that night.',

  recoveryTitle: 'Slower recovery',
  recoveryText: (p) =>
    `The morning after a match, even the stairs are hard. A specialist recovery trainer would cost ${p.fee}.`,
  recoveryHireLabel: 'Hire the trainer yourself',
  recoveryHireOk:
    'Ice baths and sleep tracking every day. Recovery that took three days now takes two.',
  recoveryRestLabel: 'Ask the manager for rotation',
  recoveryRestOk:
    'The manager left you out of the midweek match. You played the weekend on fresh legs.',
  recoveryRestFail:
    '"I still need you." The manager shook his head, and your name was on the next team sheet too.',

  mentorTitle: 'A youngster’s request',
  mentorText:
    'A 19-year-old rookie hovers in front of your locker. "How do you prepare before a match?"',
  mentorTeachLabel: 'Stay after training and show him step by step',
  mentorTeachOk:
    'You showed him everything from stretching to the pre-match meal. A month later he scored his first goal and ran straight to you.',
  mentorRestLabel: 'Laugh it off and look after yourself first',
  mentorRestOk:
    'You gave him a quick tip and headed to the recovery room. You slept well that night.',
};
