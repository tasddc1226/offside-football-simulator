import type { Translation } from '../core';
import type { AttendanceMsgs } from '../ko/attendance';

const tickets = (n: number) => (n === 1 ? 'ticket' : 'tickets');

export const attendance: Translation<AttendanceMsgs> = {
  title: 'Daily check-in',
  streak: (p) => `${p.n}-day streak`,
  board: (p) => `Stamps ${p.filled}/${p.total}`,
  todayLabel: "Today's reward",
  tomorrowLabel: "Tomorrow's reward",
  grace:
    "Check in every day to get that day's reward. Missed days keep your stamps, and missing one day a week keeps your streak.",
  btn: 'Check in',
  busy: 'Stamping…',
  checked: 'Stamped for today',
  stamped: (p) => `Stamp ${p.n} collected. You got: ${p.reward}`,
  fail: "Couldn't check in. Please try again in a moment.",
  reroll: (p) => `${p.n} reroll ${tickets(p.n)}`,
  boost: (p) => `${p.n} boost ${tickets(p.n)}`,
  scout: (p) => `${p.n} premium scout ${tickets(p.n)}`,
<<<<<<< HEAD
  rename: (p) => `${p.n} player rename ${tickets(p.n)}`,
=======
>>>>>>> origin/main
  itemReroll: 'Reroll ticket',
  itemBoost: 'Boost ticket',
  itemScout: 'Premium scout ticket',
  boardLabel: (p) => `${p.filled} of ${p.total} stamps collected`,
  entryToday: (p) => `Today: ${p.reward}`,
  entryDone: 'Stamped today',
  entryGuest: 'Log in for daily rewards',
  entryLabel: 'Open daily check-in',
  close: 'Close',
  guestLead: (p) =>
    `Log in to check in every day and collect rewards. Over ${p.days} days you get: ${p.reward}`,
};
