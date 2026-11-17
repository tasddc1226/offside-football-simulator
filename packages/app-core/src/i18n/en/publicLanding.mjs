// App · web intro page copy (/en/app/). Same shape as ko/publicLanding.mjs (apps/web/scripts/seo.test.mjs).
// Reviews are translations of Korean App Store reviews, and the page says so.
export default {
  meta: {
    title: 'OFFSIDE | Football career simulator from age 18 to retirement',
    description:
      'Raise one 18-year-old footballer through a pro debut, transfers and the national team all the way to retirement. Then build an owner team from your retired players and face other players in leagues and cups. Play on iPhone, Android or the web.',
  },
  // Date of the numbers on screen and Hall of Fame count (update with LANDING_STATS).
  asOf: 'Nov 18',
  legends: '180,000',
  skip: 'Skip to content',
  playTop: 'Play on the web →',
  logoLabel: 'OFFSIDE Full Time',
  subtitle: 'Full Time: until the final whistle',
  h1: 'A football career simulator where you raise one player from age 18 to retirement',
  h1Small: 'Your choices decide the pro debut, transfers and national team call-ups.',
  sticker: ['S2', 'NOW', 'ON'],
  webSmall: 'No install',
  web: 'Play on the web',
  qrTitle: 'Scan to get the app',
  qrBody: 'Opens the right store for iPhone or Android',
  ticker: [
    'Installed it after dinner, looked up and it was 5 a.m.',
    'The peak of football sim games',
    'The most fun mobile game in a long time',
    'Fast feedback and fast updates from the developer',
    'If I get an S-rank player just once, I have no regrets',
  ],
  path: {
    tag: 'One career',
    title: 'It starts at 18 and ends with retirement',
    lead: 'You start by picking one of three prospects. Even with the same player, every career turns out differently.',
    items: [
      [
        '18',
        'Final school year',
        'Choose to train speed, shooting or passing, then play your matches.',
      ],
      [
        '20',
        'Debut and transfers',
        'Weigh playing time and league position when offers come in. Loans and moves abroad happen too.',
      ],
      [
        '27',
        'National team',
        'Get called up for internationals and tournaments. Korean players also pick when to do military service.',
      ],
      [
        '30',
        'Prime and legacy',
        'Try to extend your prime, then turn your savings into a retirement legacy and collectibles.',
      ],
      [
        '38',
        'Retirement',
        'Your record goes into the Hall of Fame. More than {legends} players are already there.',
      ],
    ],
  },
  after: {
    tag: 'After retirement',
    title: 'Build your own team from the players you raised',
    lead: 'Retired players join your owner team. Then you take on other players’ teams.',
    items: [
      ['Owner team', 'Build a squad of retired players and upgrade their cards.'],
      ['League', 'Play 28 rounds and move up or down by final position.'],
      ['OFFSIDE Cup', 'A knockout tournament between player teams every season.'],
      ['Ranked matches', 'Change the result with in-match decisions.'],
      ['Transfer market', 'Buy and sell players with other users.'],
      ['Manager career', 'A retired player becomes a manager and runs a club.'],
    ],
  },
  reviews: {
    tag: 'What players say',
    title: 'App Store reviews',
    stars: '5 stars',
    cite: 'Korean App Store review · {date}',
    score: 'App Store (Korea) · {count} ratings ({asOf})',
    note: 'Translated from Korean',
    items: [
      ['Installed it after dinner, looked up and it was 5 a.m.', 'Oct 6'],
      ['You raise players, then use them in cups and leagues, and bugs get fixed fast', 'Nov 13'],
      ['First game where I watch ads because I want a better player', 'Oct 11'],
      ['Fast feedback and fast updates from the developer. Great', 'Oct 10'],
      ['The most fun mobile game in a long time', 'Oct 9'],
      ['If I get an S-rank player just once, I have no regrets.', 'Oct 5'],
    ],
  },
  shots: {
    tag: 'Screenshots',
    title: 'In the game',
    note: 'Screenshots show the Korean version. The game itself is fully in English.',
    items: {
      season: ['Season table', 'Season table screen'],
      live: ['Live commentary', 'Text match commentary screen'],
      pk: ['Penalty shootout', 'Penalty shootout mini-game screen'],
      credits: ['Career record', 'Career record screen of a retired player'],
    },
  },
  where: {
    tag: 'Where to play',
    title: 'One career on app and web',
    body: 'Play on iPhone, Android or in your browser. Move your career with a backup code or by linking a Google or Apple account. New here? The <a href="{guide}">game guide</a> walks you through it.',
  },
  faq: {
    tag: 'Questions',
    title: 'FAQ',
    items: [
      [
        'Do ads or purchases change the odds?',
        'Watching ads and buying ad removal do not affect any odds. What paid items do and all the odds are published on the <a href="/fairness/">odds and fairness</a> page (Korean).',
      ],
      [
        'Can I only play as a Korean player?',
        'You can pick any nationality. Careers start in a Korean high school’s final year, and you can move abroad. Military service applies only to Korean nationals.',
      ],
      [
        'Can I move my web career to the app?',
        'Yes, with a backup code or by linking a Google or Apple account.',
      ],
      ['Which languages are supported?', 'Korean, English, Japanese and Traditional Chinese.'],
    ],
  },
  last: 'Season 2 is on now',
  foot: {
    guide: 'Game guide',
    faq: 'FAQ',
    fairness: 'Odds and fairness',
    about: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
  },
};
