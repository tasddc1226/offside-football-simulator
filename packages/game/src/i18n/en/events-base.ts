// 이벤트 영어 문구 — 정의 모듈의 이벤트 id → 문구(events-data.ts EventText).
import type { EventText } from '../../events-data';
import { adFee, byPos, bestKey, fmtMoney, labelOf, roleOf, trainerFee } from '../../engine';
import { POS } from '../../data';

export const events_base: Record<string, EventText> = {
  'bench-talk': {
    title: "Knock on the manager's door",
    text: () => "Your playing time isn't growing. You stand outside the manager's office.",
    choices: [
      {
        label: 'Demand a chance to play',
        ok: 'The manager nodded. "You start the next match."',
        fail: '"You think you call the shots here?" The mood turned icy.',
      },
      {
        label: 'Quietly stay on at training',
        ok: 'The evening sessions pile up. The coaches are watching.',
      },
    ],
  },
  knock: {
    title: 'Pain in training',
    text: () => 'Your hamstring twinged in training. The medical team recommends rest.',
    choices: [
      {
        label: 'Play through it next match',
        ok: 'You got through it without trouble. The manager rated your grit highly.',
        fail: 'The pain came back mid-match. You are out for a long spell.',
      },
      {
        label: 'Rest up',
        ok: 'You sat out two matches and recovered fully.',
      },
    ],
  },
  ad: {
    title: 'Endorsement offer',
    text: (s) =>
      `A sports brand has offered you an endorsement deal. The fee is ${fmtMoney(adFee(s))}.`,
    choices: [
      {
        label: 'Sign the deal',
        ok: (s) =>
          roleOf(s) === '주전'
            ? "The shoot was exhausting, but your bank balance looks healthy. The club's marketing team is delighted."
            : 'Your bank balance looks healthy, but the talk is "more ads than matches".',
      },
      {
        label: 'Focus on football only',
        ok: 'Fans like seeing you focused on football alone.',
      },
    ],
  },
  interview: {
    title: 'Pre-match interview',
    text: () => 'A reporter thrusts a microphone at you. "Are you confident about this opponent?"',
    choices: [
      {
        label: byPos<string>({
          FW: '"I\'ll score and we\'ll win."',
          MF: '"I\'ll dominate the match."',
          DF: '"Their striker won\'t get past me once."',
          GK: '"I\'m not conceding a single goal today."',
        }),
        ok: byPos<string>({
          FW: 'You scored just as promised. The highlights flood social media.',
          MF: 'A 94% pass completion rate. You ran the midfield just as promised.',
          DF: 'You kept their star man to zero shots. The promise became reality.',
          GK: 'A clean sheet, just as promised. Your saves reel floods social media.',
        }),
        fail: byPos<string>({
          FW: 'After a quiet match, mocking memes start to circulate.',
          MF: 'You were beaten in midfield. Your big talk is being replayed.',
          DF: 'Their striker scored twice. Screenshots of your interview are going round.',
          GK: 'Memes pairing every goal you conceded with your interview quote are doing the rounds.',
        }),
      },
      {
        label: '"Winning as a team comes first."',
        ok: 'A safe answer. The manager seems pleased.',
      },
    ],
  },
  rival: {
    title: 'Rival signed at your position',
    text: (s) =>
      `The club has spent big on a new ${POS[s.pos].label.toLowerCase()} to compete for your spot.`,
    choices: [
      {
        label: 'Double the training intensity',
        ok: 'The competition sharpened your focus in training.',
        fail: 'After overdoing the training, your muscles started to ache.',
      },
      {
        label: 'Stick to your usual routine',
        ok: (s) =>
          s.age >= 28
            ? "Like a veteran, you didn't flinch. The manager decides to trust your experience."
            : "You didn't flinch, but the manager's attention seems to have drifted.",
      },
    ],
  },
  scout: {
    title: 'Overseas scout in the stands',
    text: () => "Word is a scout from a big European club is at today's match.",
    choices: [
      {
        label: byPos<string>({
          FW: 'Go for a solo showcase',
          MF: 'Catch their eye with killer passes and slipping the press',
          DF: 'Impress with aggressive tackles and stepping up',
          GK: 'Impress with bold saves and build-up play',
        }),
        ok: "Your name went down in big letters in the scout's notebook. Interest built ahead of the transfer window.",
        fail: byPos<string>({
          FW: 'You got greedy. You kept forcing shots and were substituted.',
          MF: 'You got greedy. Your overly ambitious dribble was cut out and they countered.',
          DF: 'You pushed up too eagerly and left space in behind.',
          GK: 'A reckless forward pass was cut out and led to a goal.',
        }),
      },
      {
        label: 'Stick to team play',
        ok: "It wasn't flashy, but it was a solid match.",
      },
    ],
  },
  party: {
    title: 'Party invitation',
    text: () =>
      "An invitation to a celebrity's birthday party has arrived. The match is in two days.",
    choices: [
      {
        label: 'Drop in briefly',
        ok: 'You widened your network and cleared your head.',
        fail: 'Photos from the small hours made the papers. The club fined you.',
      },
      {
        label: 'Stay home and sleep well',
        ok: "You're in peak condition.",
      },
    ],
  },
  mentor: {
    title: 'Advice from a legend',
    text: (s) =>
      `A retired legend has come to the training ground. "Your ${labelOf(s, bestKey(s))} is good, but the rest is lacking."`,
    choices: [
      {
        label: 'Learn their secrets',
        ok: 'One small habit changed your game.',
        fail: "Your body isn't ready to copy it yet.",
      },
      {
        label: "Say you'll sharpen your strengths",
        ok: '"That\'s one way." The old pro smiled.',
      },
    ],
  },
  newcoach: {
    title: 'Manager sacked',
    text: () =>
      'The manager has been sacked after poor results. The new one plays a completely different system.',
    choices: [
      {
        label: 'Adapt to the new tactics first',
        ok: 'You became the first player the new manager called on.',
        fail: 'You were marked down for not grasping the tactics.',
      },
      {
        label: "Don't rush. Wait and see",
        ok: "The new manager says they'll go by the previous manager's assessments. Much of the trust you built carries over.",
      },
    ],
  },
  haters: {
    title: 'Flood of abuse online',
    text: () => 'After a recent poor match, abusive comments are pouring in on social media.',
    choices: [
      {
        label: 'Hit back head-on',
        ok: 'Fans answered your confident response with support.',
        fail: 'The controversy got bigger.',
      },
      {
        label: 'Delete the apps and focus on training',
        ok: 'You feel more at ease.',
      },
    ],
  },
  trainer: {
    title: 'Personal trainer',
    text: (s) =>
      `A famous performance trainer offers a one-year exclusive deal. The cost is ${fmtMoney(trainerFee(s))}.`,
    choices: [
      {
        label: 'Invest in it',
        ok: (s) =>
          s.age <= 23
            ? 'It feels like your physical ceiling has been raised.'
            : 'Niggles are fewer, and it feels like your physical ceiling has risen a little.',
        fail: 'The training was too much for a tired body. You paid for it and still strained a muscle.',
      },
      {
        label: "Follow the club's sports science program",
        ok: "You saved the money. You built a tailored program with the club's sports science team, and the results will come slowly.",
      },
    ],
  },
  charity: {
    title: 'Youth football clinic',
    text: () => 'Your hometown elementary school has asked you to volunteer at a football clinic.',
    choices: [
      {
        label: 'Gladly go',
        ok: "You kicked a ball around with the kids for a long time. It's been a while since you laughed without pressure.",
      },
      {
        label: "Decline, it's mid-season",
        ok: 'A shame, but you chose rest. The manager called it a professional decision.',
      },
    ],
  },
  slump: {
    title: 'Slump',
    text: byPos<string>({
      FW: "The goal looks unusually small. You haven't scored in a few matches, and you can't sleep well.",
      MF: "Your passes keep going astray. You can't sleep well either.",
      DF: 'You gave up space in behind again and again. Even with your eyes shut, you see the goals going in.',
      GK: 'Routine shots keep slipping through your fingertips. Even with your eyes shut, you see the goals going in.',
    }),
    choices: [
      {
        label: 'See a mental coach',
        ok: 'You feel much lighter.',
        fail: 'It looks like you still need more time.',
      },
      {
        label: 'Get through it alone',
        ok: 'You toughed it out alone. The manager noticed the change in you at training.',
        fail: 'The slump is dragging on.',
      },
    ],
  },
  penalty: {
    title: 'Decisive penalty',
    text: () => 'Stoppage time, 1-1. A penalty is awarded and the captain looks at you.',
    choices: [
      {
        label: "I'll take it",
        ok: 'The net ripples! A last-gasp winner!',
        fail: 'You hit the crossbar... The stadium went quiet. Pushing past the designated taker has people talking.',
      },
      {
        label: 'Defer to the designated taker',
        ok: "Your teammate scored. The manager remembers you for sticking to the team's rules.",
      },
    ],
  },
  'pk-save': {
    title: 'Penalty shoot-out',
    text: () => 'A cup shoot-out. The last taker places the ball down.',
    choices: [
      {
        label: 'Dive left',
        ok: "Saved! You're a hero.",
        fail: 'Wrong way.',
      },
      {
        label: 'Wait it out',
        ok: 'You waited to the last second and caught the shot down the middle!',
        fail: 'It was tucked into the corner.',
      },
    ],
  },
  family: {
    title: 'A call from home',
    text: () => 'You hear that your mother is unwell. You have an away match coming up.',
    choices: [
      {
        label: 'Take leave and go home',
        ok: "You stayed by your family's side. Thankfully she recovered quickly. The manager gladly let you go.",
      },
      {
        label: 'Focus on the match',
        ok: 'Your mother was happier than anyone when she heard about the win.',
        fail: 'Your mind was elsewhere. You made a mistake and were substituted.',
      },
    ],
  },
  rumor: {
    title: 'Transfer rumors',
    text: () => "Articles about a big-club move are pouring out. The club's fans are uneasy.",
    choices: [
      {
        label: '"A bigger stage is my dream."',
        ok: 'Interested clubs have started to move. The home fans are hurt, though.',
      },
      {
        label: '"I want to win trophies with this team."',
        ok: (s) =>
          s.contract && s.contract.years <= 1
            ? "The home fans cheered, but everyone knows there's no news on a new contract."
            : 'The home fans are chanting your name.',
      },
    ],
  },
  diet: {
    title: 'Body fat check',
    text: () => "The club's fitness coach sighs at your body fat reading.",
    choices: [
      {
        label: 'Start a strict diet',
        ok: 'Your body feels lighter.',
        fail: "You couldn't resist the late-night snacks. All it got you was a worse mood.",
      },
      {
        label: 'Eating well is what counts',
        ok: 'You ate well and slept well. Your body is a little heavier, but you are full of energy.',
      },
    ],
  },
  final: {
    title: 'National tournament final',
    text: () => 'The national tournament final. Pro scouts fill the main stand.',
    choices: [
      {
        label: 'Settle it like an ace',
        ok: "You dominated the final. The scouts' phones start ringing.",
        fail: 'Runners-up. You cried, but the form that took you to the final caught their eye.',
      },
      {
        label: 'Lift your teammates',
        ok: 'The team came together. The manager said, "A real ace lifts teammates," and put you at the top of the recommendation list.',
      },
    ],
  },
};
