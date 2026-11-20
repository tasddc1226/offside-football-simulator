import type { Translation } from '@offside/contracts/i18n';
import type { gFollowupText } from '../ko/gFollowup';
export const gFollowup: Translation<typeof gFollowupText> = {
  roleTitle: 'The number six is back',
  roleGood:
    'The regular holding midfielder is back. The coach places two magnets where you won the ball in his absence. “What if you played side by side?”',
  roleBad:
    'The number six is back. The coach freezes the footage where a runner slipped behind you. “Push up again, or try it with him alongside you?”',
  pair: 'Try a double pivot',
  pairOk:
    'Your partner steps to the ball and you cover behind. The coach asks you to remember that distance.',
  push: 'Move up to receive the forward pass',
  pushOk:
    'The returning midfielder fires a pass into you. One touch on your back foot takes you beyond the opposing midfielder.',
  markFixture: (p) => `Round ${p.rd} against ${p.club}. ${p.body}`,
  markTitle: 'The top scorer returns',
  markMan:
    'The striker you shadowed last time drifts to the touchline. A winger sprints into the space he leaves.',
  markZone:
    'You held the middle last time. Now the striker pulls wide as the winger cuts inside, trying to catch you between assignments.',
  follow: 'Follow the striker and deny the turn',
  followOk: 'You close as he takes his first touch. With his back to goal, he rolls the ball back.',
  hand: 'Pass him to the fullback and cover the runner',
  handOk:
    'You catch the fullback’s eye and take two steps inside. The pass intended for the winger hits your boot.',
  kickTitle: 'They know the signal',
  kickBody:
    'You raise a hand. A defender leaves the wall to mark your short option. They remember your last routine.',
  shoot: 'Shape for the short pass, then curl it through the gap',
  shootOk:
    'A glance at your teammate sells the pass. Your shot clears the wall and forces a diving save.',
  far: 'Clip it towards the far-post runner',
  farOk:
    'As the defender steps out, you clip the ball to the far post. Your teammate runs onto it and makes contact.',
  youthTitle: 'An invitation from your old academy',
  photo:
    'Your late coach’s youth team invites you to visit. You take the debut photo the family gave you at the funeral.',
  armband:
    'Your late coach’s youth team invites you back. A child asks, “Why did you wear that black armband that day?”',
  tell: 'Tell them about your first day with the coach',
  tellOk:
    'You describe where you stood tying your boots that first day. The children settle in a circle on the grass.',
  teach: 'Run the first drill your coach taught you',
  teachOk:
    'You set out two cones and show them a first touch. As a child traps the ball, you hear yourself using your coach’s words.',
  callTitle: 'A call before the squad announcement',
  refuse:
    'The national coach calls. “Before I name the squad, are you willing to compete again?” It is your first conversation since you refused call-ups.',
  calm: 'During club preparations, the national coach calls. “The places are still open. What are you working on?”',
  return: 'End the refusal and compete for a place',
  returnOk: 'You agree that form will decide your role. You are eligible for selection again.',
  wait: 'Stand by the refusal for now',
  waitOk:
    'You thank the coach for calling. You will stay with your club for the period you originally agreed.',
  compete: 'Ask which role the squad needs',
  competeOk:
    'The coach describes the movement needed late in games. You agree to practise it at your next session.',
  club: 'Let your club performances speak',
  clubOk:
    'You give the coach the date of your next league game and glance at the fixture list as you hang up.',
};
