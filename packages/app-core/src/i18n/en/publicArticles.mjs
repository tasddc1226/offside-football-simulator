// T-11-452 Public strategy articles (/guide/<slug>/). Plain ESM read by the Node SEO build; not an app runtime namespace.
// Rules and numbers must match the game guide (i18n/<lang>/publicGuidePage.mjs). A PR that changes a rule must update this file too.
export default [
  {
    slug: 'first-career',
    title: 'Starting Your First Career: What to Check When Creating a Player',
    description:
      'How to choose a position, focus attributes and growth trait when you create your first player in OFFSIDE, and how to pick among the three candidates.',
    lead: 'Your first player stays with you for more than 20 seasons until retirement. A few choices on the player creation screen set the direction of the whole career, so it helps to know what the information on screen means before you start.',
    sections: [
      [
        'Position and detailed position',
        [
          'There are four positions, FW, MF, DF and GK, and you pick a detailed position within each. Each detailed position weighs different attributes heavily when OVR is calculated. The creation and candidate screens show the main OVR attributes for each position, so check which attributes matter most at the spot you chose.',
          'Forwards pile up goals and attacking contributions easily and stand out in Hall of Fame rankings, while defenders and goalkeepers have less flashy numbers for the same quality of play. Retired number review, however, looks at contribution by position separately, so a defensive player who stays at one club for a long time has a real shot at one.',
        ],
      ],
      [
        'Focus attributes and player type',
        [
          'Pick two focus attributes and, combined with your position, they decide your player type (Poacher, Speedster, Stopper, Attacking fullback and so on). The type does not change during the career. It matters even more after retirement than during your playing days, because the type decides which spots a player can fill in an owner team and which team synergies they belong to.',
          'So for your first player, choose by the role you want to use in your team later rather than by the combination that looks strongest. You can preview which combination becomes which type on the creation screen and in the player type section of the Odds guide.',
        ],
      ],
      [
        'Growth trait and the three candidates',
        [
          'The growth trait decides when a player grows the most. An early developer rises quickly at a young age and can win playing time in the early seasons, while a late bloomer starts slowly but blossoms late in their twenties. Neither is the right answer. It comes down to whether you prefer becoming a starter quickly or playing well for a long time.',
          'When you finish the setup, three candidates with the same total attributes appear. Since the totals match, do not choose by OVR alone. Compare how high the main attributes of your chosen detailed position are. The true potential is revealed at retirement, and height and weight only shift the initial attribute distribution slightly, so starting OVR stays the same.',
        ],
      ],
    ],
  },
  {
    slug: 'training',
    title: 'Training and Self-Investment: How to Run a Season',
    description:
      'How to choose training and self-investment in each pre-season, first half and second half, what you lose by building only one attribute, and when to rest.',
    lead: 'A season in OFFSIDE has three phases: pre-season, first half and second half. In each phase you pick a training direction and self-investment, and the match results are calculated in one go. Each choice looks small, but over 20 seasons they add up to a completely different player.',
    sections: [
      [
        'The four training directions',
        [
          'You choose from attribute training, rest and recovery, personal coach and media work. Attribute training is the basic way to raise OVR, and rest and recovery looks after a tired body. What each one does is written in the description shown when you pick it, so in your first few seasons the fastest way to learn is to read the descriptions and try each one.',
          'After you pick a training, its description appears below, and in the coach notes you can see how OVR and attributes have changed since the start of the season. Rather than repeating the same training, get in the habit of reading the coach notes and deciding the next phase from them.',
        ],
      ],
      [
        'Why building only one attribute costs you',
        [
          'If you push one attribute too far ahead of your other main attributes, training growth shrinks. The size of the reduction is shown in the description when you pick a training. OVR looks at all the main attributes of a detailed position together, so a player with evenly high main attributes raises OVR faster than one with a single high attribute.',
          'There is an exception for players rated by the higher of two roles, such as a wide midfielder of the Winger type or a striker of the Target man type. Raising the attributes of either role can raise their OVR. Check both role values in the per-position OVR on the attribute screen.',
        ],
      ],
      [
        'When to use self-investment',
        [
          'Separately from training, you can spend funds each phase on weakness drills, strength drills, medical care and mental coaching. Costs scale with salary, so the same investment is cheaper in your low-salary younger years.',
          'The growth from drills is also affected by age, potential and morale. In a phase where morale has dropped, recovering it first with mental coaching or rest can help next phase’s growth more than drills. If you get injured often, consider medical care first.',
        ],
      ],
    ],
  },
  {
    slug: 'potential',
    title: 'What Potential Really Means, and Potential Boosts',
    description:
      'In OFFSIDE, potential is a growth-speed benchmark, not a cap on OVR. The potential grades, changes up to age 25, and the odds and cost structure of potential boosts.',
    lead: 'It is easy to think of potential as a maximum OVR you can never exceed, but in OFFSIDE potential is the benchmark for growth speed. Once you understand this difference, it gets much easier to decide when to spend funds on boosts.',
    sections: [
      [
        'Potential is not a cap',
        [
          'Growth depends on age, how much room remains up to your potential, and morale. Growth slows as OVR approaches potential, but it keeps going a little even after OVR reaches it. So it is more accurate to think that the higher the potential, the faster and longer the same training makes a player grow.',
          'True potential is revealed at retirement. During the career, the scout sums up the player’s level in a single line in the season review, and the retirement report breaks it down for the first time into initial potential, changes during the growth years, boosts and events. The grades are S 90 or higher, A 84–89, B 78–83, C 70–77 and D 69 or lower.',
        ],
      ],
      [
        'It rises and falls on its own until age 25',
        [
          'True potential moves up and down a little at random each season until age 25. This variation follows the same rule for every player regardless of choices, so no action can avoid it or push it up. Events that raise potential directly, such as investing in a famous trainer (+2 at age 23 or younger, +1 after that), are separate from this.',
        ],
      ],
      [
        'When to boost potential',
        [
          'From the end of your first season until age 29, you can raise potential with funds using Potential Boost in the Player tab. You can try once per season, up to 4 stages, and the higher the stage, the higher the cost and the lower the success chance. Each success raises potential by 1. Signed-in club owners can also use club funds for a guaranteed boost, which raises one stage with no roll, once per player.',
          'A failure only costs you the funds, but each failure raises the next success chance by 5 percentage points. Since potential is a growth-speed benchmark, the same +1 pays off longer the earlier you get it, over the seasons that remain. In the early game, when funds are tight, trying steadily from the lower stages is more efficient.',
          'In a season when you are short on funds, you can watch a rewarded ad to the end in the app, or, if you are a signed-in owner, try once with club funds. Potential Boost tickets bought in the app have the same success chance as trying with funds, and the same stage cap and age limit.',
        ],
      ],
    ],
  },
  {
    slug: 'transfer',
    title: 'Transfers, Renewals and Loans: Choosing Your Next Destination',
    description:
      'How to choose between staying, renewing and moving at the end of a season, how to read the estimated finish on a transfer offer, and how to use a loan when you are not getting playing time.',
    lead: 'When a season ends, you pick your next destination from staying, renewing and transfer offers. The offer with the highest salary is not always the best choice, because career records ultimately come from playing time.',
    sections: [
      [
        'What to look at in an offer',
        [
          'Depending on your results and reputation, offers also come from overseas leagues, and each offer shows its evaluation factors and playing-time conditions. A contract length does not guarantee playing time, so even if you move to a bigger club, your records can stall if you lose the fight for a starting spot.',
          'The estimated finish on an offer is a reference figure calculated from club strength, not the current standings. After moving to another club, entry to continental competition in your first season is decided by this estimated finish and each league’s qualification slots. If you stay, the actual finish from last season is used instead. If you want to play in continental competition, choose with this difference in mind.',
        ],
      ],
      [
        'Renewing and staying long',
        [
          'When one year remains on your contract, the club can offer an early extension. You do not have to extend: you can stay on your current terms or move to another club. From age 41 you only get one-year contracts, and renewal depends on how you played last season.',
          'Staying at one club for a long time means more than records. A retired number requires at least 6 seasons at one regular professional club plus meeting the contribution requirement, and the One-club man and Long service achievements are also judged by seasons spent at a single club. If you have a goal for after retirement, factor it in when you choose a transfer.',
        ],
      ],
      [
        'When you are not getting playing time: loans',
        [
          'If a professional aged 26 or younger is not a starter and has few appearances or goal contributions, or fails two or more events in a season, a playing-time talk can open during the season. If you ask for a loan, a one-season loan offer from a club in a league of the same tier or lower is attached after the season ends.',
          'While you are on loan, your salary and contract stay with your parent club. When the loan ends you return to your parent club, or, if you played 15 or more matches with a rating of 6.8 or higher, you can receive a permanent transfer offer from the loan club. Coming back after playing well raises manager trust. Note, though, that a loan season counts as a season at a different club for the One-club man and Long service checks.',
        ],
      ],
    ],
  },
  {
    slug: 'national-team',
    title: 'National Team and Military Service: A Crossroads for Korean Players',
    description:
      'How national team call-ups, international tournaments, international retirement and military service for Korean players (Gimcheon Sangmu, active duty and the sports service exemption) affect your career.',
    lead: 'Playing for the national team adds a lot to your records and titles, but each call-up costs condition. If your player is Korean, you also have to pass through the big crossroads of military service. Knowing both ahead of time makes career planning much easier.',
    sections: [
      [
        'National team call-ups and international tournaments',
        [
          'Once called up, you play in international tournaments such as the A-match, Asian Cup, World Championship, Olympics and Asian Games. A-match records stay in the retirement report and Hall of Fame as they are, and titles like senior national team debut or World Championship winner also unlock gold record items for your pixel player.',
          'A player aged 31 or older with at least 10 A-match appearances can choose to retire from international football once per season, after the call-up phase. Retiring saves the condition that call-ups used to drain, but it cannot be undone, so consider it when you want to extend your club career.',
        ],
      ],
      [
        'Military service for Korean players',
        [
          'When a Korean player reaches the age of military obligation, they choose between joining Gimcheon Sangmu and active-duty enlistment. Service time is not a regular club season, so it is excluded from the One-club man and Long service checks, and a loan is only possible if your enlistment deadline does not fall during the loan.',
          'If you are named to a tournament squad and win an Asian Games gold medal or an Olympic medal, you receive a service exemption and are placed in sports service. You keep playing without joining Sangmu or active duty, fill your service time season by season, and the service ends when 34 months are complete. If you grow enough to be picked for the national team in your early twenties, you get a chance to avoid breaking the flow of your career.',
        ],
      ],
      [
        'Squad snubs and call-up refusal',
        [
          'If you have senior national team experience but are left out of the final World Championship squad, you may face a squad snub event in the next season’s pre-season. If you declare a call-up refusal, you are left out of senior national team call-ups and continental cup and World Championship squads for that season and the next, and if you were captain you give up the armband. Asian Games and Olympic squads are not affected.',
        ],
      ],
    ],
  },
  {
    slug: 'hall-of-fame',
    title: 'When to Retire, the Hall of Fame and Retired Numbers',
    description:
      'When it is best to retire, the legend score and the conditions for entering the Hall of Fame, retired number review, and the Wall of Honour title.',
    lead: 'A career in OFFSIDE is completed by retirement. The moment you retire, your career totals turn into a legend score, your hidden potential is revealed, and players who meet the conditions put their names in the Hall of Fame and on a retired number.',
    sections: [
      [
        'When to retire',
        [
          'You can choose to retire from age 25, and you retire automatically when you reach the retirement age. A player created in season 1 retires at 45, and each time someone plays to the retirement age and retires in a season, the next season’s retirement age goes up by one year.',
          'Only players who retire at age 30 or older enter the Hall of Fame, and shorter careers that end earlier stay in your My Players list only. Career totals are the basis of the legend score, so if you can keep playing even as your ability starts to decline, playing a little longer is better for your records.',
        ],
      ],
      [
        'Legend score and the Hall of Fame',
        [
          'When you retire, your career totals, trophies and awards produce a legend score and grade, and your potential evaluation and peak OVR are revealed. The Hall of Fame has rankings for legend score, goals, assists, appearances, trophies, Ballon d’Or, retirement value, and rankings by position.',
          'Your player’s name is shown in the Hall of Fame if Show player name is on in settings, and shown anonymously if it is off. You can also show off your career with a share link and image.',
        ],
      ],
      [
        'Retired numbers and the Wall of Honour',
        [
          'If your player name is public and you retire at age 30 or older, you go through retired number review. You need at least 6 seasons at one regular professional club and must meet the contribution requirement for your position, and the top two eligible clubs by contribution are the candidates. Club contribution builds from appearances, goals, assists and clean sheets at that club, plus club trophies and individual awards.',
          'Clubs and shirt numbers in the same service season are shared by all users, and only the first player reviewed gets a given club and number. If you meet the requirements but every candidate club’s number has already been retired, you receive a Wall of Honour title. Keep in mind that popular numbers at popular clubs are the most competitive.',
        ],
      ],
    ],
  },
  {
    slug: 'owner-team',
    title: 'Building an Owner Team, Team Synergy and Offside Cup Prep',
    description:
      'How to build an owner team from retired players, position fit and team synergy, the manager slot, Offside Cup entry conditions, and how match results are decided.',
    lead: 'Retired players get a second life in an owner team. Once you sign in you become an owner, build one team per service season, play against other owners’ teams, and take on the Offside Cup held each season.',
    sections: [
      [
        'Building the lineup',
        [
          'You place your retired player cards into the 11 spots of a formation. You can use both players you raised yourself and players signed from the transfer market, and youth players fill empty spots, so even a single retired player is enough to play. When you drag a player to another spot, they play as the detailed position that matches where you drop them.',
          'The better a player fits their spot, the higher the fit. W, LW and RW spots are measured by winger-role ability, so a Winger type who developed as an attacking or central midfielder will rate lower than their OVR there if pace and crossing fall short. Rather than placing by OVR alone, check how much a player really delivers in that spot.',
        ],
      ],
      [
        'Team synergy and the manager',
        [
          'When team synergies activate from player type combinations, strong foot and players you raised yourself, your team gets stronger in matches. Duo synergies check both the player type and the lineup position, and each duo applies only once even if you have several matching pairs, while the effects of different synergies add up. With 7 or more starters of the same nationality, the national team lineup synergy activates. With 7 or more starters who share their longest-played league, League colors activates (if both are on, the side with more players applies), and 3 or more starters from the same longest-played club activate Club teammates.',
          'Seat a finished manager in the manager slot and their mastery of the current formation is added to the three lines: attack, midfield and defense. Each line has a cap on the adjustment, though, so between equally strong teams even the best manager raises win rate by less than 5 percentage points. A manager cannot replace a good lineup. Think of them as the final touch.',
        ],
      ],
      [
        'Preparing for the Offside Cup',
        [
          'Each service season, a cup tournament is held between owner teams. Only teams with at least 8 of the 11 starting spots filled (6 in the Junior division, with youth players in the empty spots) and no starters listed on the transfer market can enter, and from the 3rd cup a separate tournament runs for each team OVR division (Junior, Senior, Master).',
          'Cup match results are decided not by the team OVR average but by the attack, midfield and defense strength after adding formation, synergy and manager adjustments, and a stronger team can still lose. From the 3rd cup the strength gap counts as much as in ranked matches, but even with a 10-point lead on all three lines, the 90-minute odds are roughly 72% win, 17% draw and 11% loss. Lineups lock one hour before a match, so recheck your synergies and position fit before then.',
        ],
      ],
    ],
  },
  {
    slug: 'manager',
    title: 'What to Know Before Starting a Manager Career',
    description:
      'What changes when you start a manager career with a retired player, how playing records carry over into manager ability, and the effects of the manager card and manager slot.',
    lead: 'An owner signed in with Google can run an 8 to 10 season manager career using a player card they own. Your playing records become the manager’s starting point, so deciding which player to turn into a manager is the first big choice.',
    sections: [
      [
        'What changes when you start',
        [
          'When you start a manager career, that card is classified as a manager and removed from this season’s lineup, friendly squads and presets, its sale listing is taken down, and it can no longer be listed on the transfer market, released or locked. Team value drops by the amount taken out of the lineup. If you are entered in the Offside Cup, a player in the starting lineup cannot be turned into a manager.',
          'You can have only one manager career in progress at a time. If you give up partway, the card returns to being a player, but you have to put it back into the lineup yourself.',
        ],
      ],
      [
        'Your playing records become the manager',
        [
          'Position leads to the manager’s style, professional seasons and appearances to Grip, the number of clubs you have been through to Adaptability, and the number of titles to Board trust. Peak OVR and legend score only feed into Reputation, which is the level of your first club. That is why a player who stayed at one club for a long time and won many titles can start more steadily as a manager than a player with a high Hall of Fame ranking.',
          'Each season you set a formation (4-3-3, 4-4-2, 3-5-2), a style (attacking, balanced, defensive, counter-attacking) and a board target, pick one thing in the transfer market, answer 2 or 3 season stories, then see the review. If you fall short of the target you can be fired, and an offer from another club can get you back on your feet.',
        ],
      ],
      [
        'The manager card and manager slot',
        [
          'When you finish the career, a manager card is finalized with formation mastery (C to S), style, specialties (up to 2), grade and ending title. Each owner team has one manager slot, and the seated manager’s mastery of the current formation (S +1.0, A +0.6, B +0.3) is added to the three lines. A style raises one line at the cost of lowering another a little, and a specialty only adds its adjustment when its paired team synergy is active.',
          'A manager card cannot be traded, but you can dismiss it from the manager screen. If it was a player you raised yourself, you receive club funds equal to the card’s base value, as with releasing a player, and if it was a signed player you receive no funds. Dismissal cannot be undone, and manager careers have no paid items.',
        ],
      ],
    ],
  },
];
