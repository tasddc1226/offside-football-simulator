import type { Translation } from '../core';
import type { VoiceMsgs } from '../ko/voice';

export const voice: Translation<VoiceMsgs> = {
  entry: 'Send feedback',
  homeTitle: 'Send feedback',
  title: 'Send feedback',
  homeSub: 'Send problems and ideas straight to us.',
  lead: "Tell us briefly what's bothering you or what you'd like. We read every message.",
  kindLabel: 'Type (optional)',
  kindBug: 'Bug or issue',
  kindIdea: 'Idea',
  kindOther: 'Other',
  bodyLabel: 'Your feedback',
  placeholder: 'What would you like to tell us?',
  placeholderBug: 'Which screen were you on, and what did you do when it happened?',
  placeholderIdea: 'What feature or change would you like?',
  count: (p) => `${p.n}/${p.max}`,
  noteReply:
    "Only our team reads this, and we can't reply here. If you need an answer, email contact@offside-lab.com.",
  noteContext:
    "Your app version, device type (web, iOS or Android, with OS version) and language are sent with it. Please don't include your email address or phone number.",
  privacy: 'Privacy policy',
  submit: 'Send',
  busy: 'Sending…',
  close: 'Close',
  empty: 'Please write something first.',
  short: 'Please write at least 2 characters.',
  fail: "Couldn't send it. Your text is still here. Please try again in a moment.",
  doneTitle: 'Got it',
  doneBody: 'Thanks for writing. We read every message and use it when planning updates.',
};
