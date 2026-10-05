// 이벤트 영어 문구 — 정의 모듈의 이벤트 id → 문구(events-data.ts EventText).
import type { EventText } from '../../events-data';

export const events_positional: Record<string, EventText> = {
  // ── Forwards ──
  'fw-drought': {
    title: 'Goal drought',
    text: (s) =>
      `${s.season.goals} goal${s.season.goals === 1 ? '' : 's'} in ${s.season.apps} ${s.season.apps === 1 ? 'match' : 'matches'}. Nothing weighs on a striker like a drought. The press is starting to ask where the go-to finisher is.`,
    choices: [
      {
        label: 'Fire 300 shots every night',
        ok: 'Your first shot of the next match hits the back of the net. The floodgates open.',
        fail: 'They go in on the training pitch, but on matchday they hit the post.',
      },
      {
        label: 'Drop the greed and set up teammates',
        ok: 'The assists pile up instead of goals. The manager calls you an unselfish number 9.',
      },
    ],
  },
  'fw-one-on-one': {
    title: 'One-on-one with the keeper',
    text: () =>
      '85th minute, 0-0. You run in behind the defense and it is just you and the keeper. The whole crowd is on its feet.',
    choices: [
      {
        label: 'Chip it over him',
        ok: 'The ball floats over the keeper and drops into the net. The winner!',
        fail: 'The keeper stayed on his feet to the end. The chip drops into his arms.',
      },
      {
        label: 'Round the keeper and roll it into the empty net',
        ok: 'You calmly go round him and slide it into the empty net. The winner!',
        fail: 'You knock it too far ahead. The ball runs out for a goal kick.',
      },
    ],
  },
  'fw-target': {
    title: 'Switch to target man',
    text: () =>
      'The manager points at the tactics board. "This season I need you holding the ball up with your back to goal. Get stronger in the duels."',
    choices: [
      {
        label: 'Accept it and add weight work',
        ok: 'Your upper body has filled out. You are no longer afraid of a physical battle with center-backs.',
        fail: 'The extra weight has left you sluggish. Even your pace, your best quality, has dulled.',
      },
      {
        label: 'Argue that runs in behind are your weapon',
        ok: 'The manager backs down. A counter-attacking plan is built around you.',
        fail: '"Then I\'ll see you on the bench." The conversation ends quickly.',
      },
    ],
  },

  // ── Midfielders ──
  'mf-freekick': {
    title: 'First-choice free-kick taker',
    text: () =>
      'A free kick in a great spot just outside the box. You lock eyes with a senior player over who takes it.',
    choices: [
      {
        label: 'Whip it in yourself',
        ok: 'The free kick clears the wall and lands in the corner! You are the designated taker from now on.',
        fail: 'It hits the wall and comes back out. The senior player pats you on the shoulder.',
      },
      {
        label: 'Play the short set-piece routine',
        ok: 'The set piece you drilled dozens of times in training ends in a goal. An assist!',
        fail: 'The timing is off and you lose the ball.',
      },
    ],
  },
  'mf-role': {
    title: 'Move to holding midfield?',
    text: () =>
      'The first-choice number 6 is out with a long-term injury. The manager asks you to drop one line deeper.',
    choices: [
      {
        label: 'Accept it for the team',
        ok: 'You win the ball and start attacks at the same time. You pick up the nickname "the midfield sweeper".',
        fail: 'Your positioning in front of the back four is awkward. You concede space in behind again and again and lose your attacking rhythm too.',
      },
      {
        label: 'Insist on an attacking role',
        ok: 'In the end the manager finds another option. "Fine, you finish things up front." You play bolder in the attacking role.',
        fail: 'You kept your spot, but the manager looks stony-faced.',
      },
    ],
  },
  'mf-press': {
    title: 'High-intensity pressing',
    text: () =>
      'The new system is gegenpressing. Midfielders have to cover 13 km a game. Three matches in, your legs feel heavy.',
    choices: [
      {
        label: 'Keep up the pressing intensity to the end',
        ok: 'You cut out their build-up and carry on to the decisive pass. Top for distance covered!',
        fail: 'In the 65th minute you cramp up. Substituted off.',
      },
      {
        label: 'Pick your pressing moments smartly',
        ok: 'You run less, but win the ball back more. The coach looks at the data and is impressed.',
        fail: '"I can\'t use a player who doesn\'t press." The manager gives you a furious dressing-down.',
      },
    ],
  },

  // ── Defenders ──
  'df-marking': {
    title: 'Marking the top scorer',
    text: () =>
      'This week\'s opponents have the league\'s top scorer. The manager says, "Stick to him like a shadow for 90 minutes."',
    choices: [
      {
        label: 'Mark him tightly, man to man',
        ok: 'You keep the top scorer to zero shots. A clean sheet and a win!',
        fail: 'For one moment you lost sight of him. They scored from that single chance.',
      },
      {
        label: 'Close down the space with zonal marking',
        ok: 'You take the space first and their star man is isolated.',
        fail: 'A through ball splits the lines. A goal conceded.',
      },
    ],
  },
  'df-lastman': {
    title: 'The last man',
    text: () =>
      'On the break, you are the last defender. Their winger is sprinting at you. If the tackle is late, it is a red card.',
    choices: [
      {
        label: 'Cut it out with a sliding tackle',
        ok: 'You take only the ball, cleanly. The home crowd cheers as if you had scored.',
        fail: 'You catch his ankle. Red card. The team has to play on with ten men, and a disciplinary hearing awaits.',
      },
      {
        label: 'Hold your ground and delay him',
        ok: 'You buy time for your teammates to get back. Danger over.',
        fail: 'He had too much pace for you, and you gave away a one-on-one with the keeper.',
      },
    ],
  },
  'df-header': {
    title: 'Going up for the corner',
    text: () => 'A corner late in a 1-1 game. The manager waves all the center-backs forward.',
    choices: [
      {
        label: 'Attack the near post',
        ok: 'It hits your head cleanly. A last-minute header from a defender wins it!',
        fail: 'You miss by a whisker. You sprint back toward your own half.',
      },
      {
        label: 'Stay back to cover the counter',
        ok: 'A cool-headed decision. You cut out their counter-attack.',
      },
    ],
  },
  'df-overlap': {
    title: 'The full-back overlaps',
    text: () => 'The flank is open. The winger cuts inside and leaves you room to overlap.',
    choices: [
      {
        label: 'Go all the way to the byline and cross',
        ok: "A pinpoint cross lands on the striker's head. An assist!",
        fail: 'The cross is cut out and you are caught on the counter, with the space behind you left empty.',
      },
      {
        label: 'Keep the defensive balance',
        ok: 'You did not overreach. The manager values the stability.',
      },
    ],
  },

  // ── Goalkeepers ──
  'gk-error': {
    title: 'A costly mistake',
    text: () =>
      'Dealing with a routine back-pass, the ball slips under your foot and rolls into your own net. The clip is spreading even in the foreign media.',
    choices: [
      {
        label: 'Play the very next match',
        ok: 'Seven saves and a clean sheet next match. You cover the mistake with your performance.',
        fail: 'Your shaken confidence brought another error. You have been pushed to the bench.',
      },
      {
        label: 'Ask the manager for a match off',
        ok: 'You rest for a match and clear your head. Your hold on the number one shirt wobbles a little.',
      },
    ],
  },
  'gk-sweeper': {
    title: 'Sweeper-keeper demands',
    text: () =>
      'The new manager wants to build out from the back. "The goalkeeper has to be an eleventh outfield player. Work on your feet."',
    choices: [
      {
        label: 'Do passing drills with the outfield players',
        ok: 'You play your way out with short passes even under pressure. The manager is pleased.',
        fail: 'Misplaced passes were frequent, and you conceded several times in tactical training.',
      },
      {
        label: "Say that a goalkeeper's first job is to stop shots",
        ok: 'You focus on shot-stopping. You grow a little distant from the manager, but your saves go up a level.',
      },
    ],
  },
  'gk-pk': {
    title: 'Penalty awarded',
    text: () =>
      'In stoppage time, with your side 1-0 up, a penalty is given. The opposing taker places the ball and stares at you.',
    choices: [
      {
        label: 'Dive the way his habits suggest',
        ok: 'Saved! A stop that secures the win. Your teammates pile on top of you.',
        fail: 'You picked the right side but only got a fingertip to it. 1-1 draw.',
      },
      {
        label: 'Play mind games on the line',
        ok: 'Your antics rattle the taker. His shot sails over the bar!',
        fail: 'He stayed cool. 1-1 draw.',
      },
    ],
  },
  'gk-no1': {
    title: 'Fight for the number one shirt',
    text: () =>
      'Only one goalkeeper can play at a time. You hear the club wants to hand the number one gloves to your rival.',
    choices: [
      {
        label: 'Prove it with your save percentage in training',
        ok: "The goalkeeping coach's report changes the manager's mind. You start the next match.",
        fail: 'Your rival got the chance first. For now you play in the cup.',
      },
      {
        label: 'Train alongside your rival',
        ok: 'Taking turns to save shots, you both improve.',
      },
    ],
  },
  'gk-cross': {
    title: 'Commanding the area',
    text: () =>
      'The opposition has brought on a tall striker and keep swinging crosses in. It is chaos in front of goal.',
    choices: [
      {
        label: 'Come out boldly and punch clear',
        ok: 'You dominate every aerial ball. The opposing manager abandons the crossing tactic.',
        fail: 'You came out and missed the ball. A header into the empty net.',
      },
      {
        label: 'Stay on your line and organize the defenders',
        ok: 'Your non-stop calling tidies up the back line. A clean sheet.',
        fail: 'You conceded after a scramble in front of goal.',
      },
    ],
  },
};
