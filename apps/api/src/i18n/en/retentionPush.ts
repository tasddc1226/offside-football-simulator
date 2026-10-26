import type { RetentionStory } from '../ko/retentionPush.js';

export const retentionPushText: Record<RetentionStory, { title: string; body: string }> = {
  career: {
    title: 'Your player is waiting',
    body: 'Tap Continue on Home to pick up where you left off.',
  },
  matches: {
    title: 'Your team played {n} ranked matches while you were away',
    body: '{w}W {d}D {l}L. See the results in your team’s recent matches.',
  },
  sold: {
    title: '{n} of your players sold while you were away',
    body: 'Check your sales and club funds in the transfer market.',
  },
  season: {
    title: 'A new season has started',
    body: 'Season {season} rankings start from zero.',
  },
  news: {
    title: 'Things changed while you were away',
    body: 'New features are collected in the update notes.',
  },
  farewell: {
    title: 'Your career is still here',
    body: 'Continue from Home any time. We won’t send another reminder after this one.',
  },
  create: {
    title: 'Time to create your first player',
    body: 'Create a player and the debut season starts right away.',
  },
  retire: {
    title: 'Your debut player is waiting',
    body: 'Finish the career to retirement to get a player card and build your own club.',
  },
  login: {
    title: 'Build a club with your retired player',
    body: 'Sign in with Google or Apple to build a club and keep your records on any device.',
  },
  club: {
    title: 'Build a club with your retired player card',
    body: 'With a club, you can play ranked matches against other owners.',
  },
  rank: {
    title: 'Time for your first ranked match',
    body: 'Pick an opponent from your team screen to start.',
  },
};
