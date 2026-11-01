// T-11-588 Body text for the public game guide (/guide/) and FAQ (/faq/). Plain ESM read only by the Node SEO build (apps/web/scripts/seo.mjs); not an app runtime namespace.
// The en, ja and zh files must have the same shape (number of sections, paragraphs and questions) (apps/web/scripts/seo.test.mjs). A PR that changes game rules or numbers must update all four languages.
/** guideCopy: publicGuide.mjs in the same language. */
export default (guideCopy) => {
  // T-10-065 Player name visibility policy (the guide, FAQ, terms and privacy policy use the same sentence).
  const NAME_POLICY =
    'If “Show player name” in Settings is on (the default), your player names are shown on Home live status, in the Hall of Fame and in server-first achievements; if it is off, they are shown anonymously.';
  // Guide sections (heading, paragraphs). Numbers are added in order.
  const sections = [
    [
      'Creating a player',
      [
        'You choose a name, shirt number, nationality, position (FW·MF·DF·GK) and detailed position, strong foot, focus attributes and growth trait (early developer, late bloomer and so on). Three candidates with the same total attributes then appear, and you start your final high school year with one of them. Height and weight only shift the initial distribution of detailed attributes slightly, and starting OVR stays the same.',
        'Your player type (Poacher, Speedster, Stopper, Attacking fullback and so on) is decided by the combination of the two focus attributes you pick along with your position, and it does not change during the career. You can see which focus combination becomes which type, and which spots and team synergies each type fits, on the player creation screen and in the Player type guide in the Odds guide.',
        'The true potential is revealed at retirement. In the app, you can watch a rewarded ad at the candidate step to see the initial potential grade range of the three candidates. Signed-in owners can use club funds instead of an ad, on the web and in the app. You then raise your player by following current attributes and growth records.',
      ],
    ],
    [
      'High school, university and turning pro',
      [
        'When your final high school year ends, you either receive a signing offer from a professional club or go to university. At university you can try for pro at any time before your fourth year, and if no offer comes by your final year you take a trial for a K3 League club.',
      ],
    ],
    [
      'Season flow, training and self-investment',
      [
        'A season runs through pre-season, first half and second half. In each phase you pick a training direction (attribute training, rest and recovery, personal coach, media activity). Match results are then calculated at once, and appearances, goals, assists, ratings and league position are recorded.',
        guideCopy.investment,
        'The Season tab shows the current year and national tournaments over the next four years. Before choosing an event option, you can close it temporarily, check other information and return to the same event. Seasons started after this update use the same league records for goal and assist rankings and season-end awards; existing seasons adopt this next season. Korea receives a dedicated Asian Games strength bonus that does not apply to the Olympics.',
        guideCopy.ratingParts,
        guideCopy.keyMoment,
      ],
    ],
    [
      'Customizing your pixel player',
      [
        'When you create a player, you can choose skin tone, hair color and hairstyle for free. Items you leave alone use the default look set for each player, and items you pick count as bought, so you can change them again for free during the career.',
        'Tap the pixel player at the top of the career screen to customize its look with career funds. You can choose skin tone, hair color, hairstyle, facial hair, expression, headband, wristband, goggles, boots and socks. Each item is bought once, and then you can change it for free as many times as you like during that career. Prices scale with salary, and customizing has no effect on attributes or match results.',
        'When you earn the Top scorer, Champion, Senior national team debut, Big Ears, Ballon d’Or or World Championship winner titles, a golden record item opens for each title (golden boots, a champion’s headband and so on). Record items are bought one by one, and once bought you can put them on or take them off at any time.',
        'When you retire, your look is fixed as it was at that moment and can no longer be changed. Your customized look also appears in your retirement report, on the Hall of Fame podium and in the owner season-review team photo.',
      ],
    ],
    [
      'Random events and stories',
      [
        guideCopy.datingRumor,
        guideCopy.partyFollowUp,
        'A random event can appear each time you advance a phase. Each option shows its success chance, and some events continue across several seasons.',
        'Options that put you in a match scene, such as penalty kicks, one-on-ones and shootouts, are decided by a timing gauge. The better your attributes, the wider the success zone, and success is decided at the moment you stop the needle. The Odds guide shows each event’s range of success chances and the factors that raise or lower them. Story and special events open in the guide only after you have met them once.',
      ],
    ],
    [
      'Attribute growth and potential',
      [
        'Card attributes such as pace, shooting, passing, dribbling, defending and physical grow together with the detailed attributes that feed into each position’s OVR. You can check the main OVR attributes for each position at player creation and candidate selection. Heading accuracy is part of defending, and for a striker’s OVR only heading accuracy counts from the defending group. A Target man striker is rated as whichever is higher, striker OVR or Target man OVR (a role that weighs heading, strength and jumping heavily), and that higher OVR also shows in the striker slot of an owner team. Even while rated as a striker, the per-position OVR on the Attributes screen shows the Target man OVR too, and training descriptions and weakness/strength focus training look at both roles. A Winger-type left or right midfielder is rated as whichever is higher, central midfielder OVR or Winger OVR, so raising pace raises OVR, and the same higher value shows in the left and right midfield slots of an owner team. Winger slots (W·LW·RW) are measured by Winger role ability, so a Winger type raised as an attacking or central midfielder can show lower than its OVR in a Winger slot if pace and crossing fall short. An attribute’s weight in OVR and its training growth rate are different things. Growth depends on age, how much room is left up to potential, and morale. In Coach notes you can see how OVR and attributes have changed since the start of the season. If you raise one attribute far ahead of the other main attributes, training growth shrinks, and when you pick a training the description below it shows the reduced rate. Potential is not a cap on OVR but a measure of growth speed: the closer OVR gets to potential, the slower it grows, and it keeps growing a little even after reaching potential.',
        'In the season review, a scout sums up your player’s level in one line. From the end of your first season until age 29, you can raise potential with funds in Potential Boost on the Player tab. You can try once per season, up to stage 4, and the higher the stage, the higher the cost and the lower the success chance. A failure only costs you the funds, and each failure raises the next success chance by 5 percentage points. 20% of successes are great successes that raise two levels at once (there is no great success when going for level +4). In the app, in a season when you are short of funds, you can watch a rewarded ad to the end to try once without funds. Signed-in owners can use club funds instead of an ad for the same single try (on the web too). In a season when you are short of funds, you can keep trying with ads or club funds even after using that one try (up to 2 in total per player), and boosts received with ads or club funds have no daily limit. A Potential Boost ticket bought in the app lets you make one try per ticket once you have used that season’s one try or when funds are short, and unlike ads and club funds it has no cap on extra tries (the stage cap and age limit are the same). The success chance is the same as when you try with funds. Signed-in owners can also get a guaranteed boost with club funds. It raises one stage with no chance involved, is available once per player, and leaves that season’s funds try untouched (the stage cap and age limit are the same; the price rises each time you get one on the same day, up to 3 a day). Each successful boost raises potential by 1. Some events also raise potential, such as investing in a famous trainer (+2 at age 23 or under, +1 after that). Separately from this, true potential rises and falls slightly at random each season until age 25, and this variation follows the same rule for every player regardless of choices. Potential grades are S 90 or higher, A 84–89, B 78–83, C 70–77 and D 69 or lower, and the retirement report breaks down starting potential, growth-phase variation, boosts and events.',
      ],
    ],
    [
      'Cups, continental competitions and individual awards',
      [
        'Depending on your league, you also play in the domestic cup, the super cup and continental club competitions (Champions League and so on). When the season ends you can go for individual awards such as Top scorer, MVP and the Ballon d’Or. If you finish first in K League 2, you are promoted to K League 1 together with your club the next season.',
        guideCopy.eraRival,
      ],
    ],
    [
      'Transfer market and contracts',
      [
        guideCopy.transferPreview,
        guideCopy.loan,
        'When the season ends, you decide your next destination from staying, renewing or transfer offers. Depending on your results and reputation, offers also arrive from overseas leagues, and each offer shows its evaluation factors and playing-time conditions. Contract length does not guarantee playing time.',
        'With one year left on your contract, the club may propose an early extension. You can also decline and stay on your current terms, or transfer to another club. From age 41 you only receive one-year contracts, and renewal depends on last season’s performance.',
      ],
    ],
    [
      'National team and military service',
      [
        'Once you are called up to the national team, you play in international tournaments such as the A-match, Asian Cup, World Championship, Olympics and Asian Games. Korean players choose between joining Gimcheon Sangmu and active duty when they reach the age of military obligation.',
        guideCopy.ntRetirement,
        guideCopy.refuseCallup,
        'If you are named to a tournament squad and win an Asian Games gold medal or an Olympic medal, you receive a service exemption and are placed in sports service. You keep playing without joining Sangmu or active duty, fill your service time season by season, and the service ends when 34 months are complete.',
      ],
    ],
    [
      'Retirement, Hall of Fame and retired numbers',
      [
        'You can choose to retire from age 25, and you retire when you reach your retirement age. If no offer comes before age 25, you can keep playing through lower-league trials. Retirement age is set in the season you create the player and does not change when seasons change. Players created in the pre-season retire at 41, and players created in season 1 retire at 45. If anyone plays to their retirement age and retires in a season, the retirement age of players in the next season goes up by one year; if no one reaches it, it stays the same.',
        'On retirement, your career records, trophies and awards produce a legend score and grade, and your potential assessment and peak OVR are revealed. Players who retire at 30 or older enter the Hall of Fame and can show off their career with a share link and image. Shorter careers that end earlier stay only in My Players.',
        guideCopy.retiredNumber,
        guideCopy.retiredNumberContribution,
        guideCopy.retiredNumberProgress,
        guideCopy.best11,
        'If you meet the retired number requirements but every candidate club’s number has already been retired, you receive the Wall of Honour title. It is separate from a retired number, and you choose your featured title yourself. For existing players, the title is recorded only when the conditions at retirement can be confirmed from server records.',
      ],
    ],
    [
      'Owner team',
      [
        'Achievements for players you raised yourself are judged by their service seasons after retirement. Long service means 10 or more cumulative seasons at one regular professional club, counting periods after returning from a transfer and excluding Sangmu and active-duty service. One-club man requires 10 or more professional seasons in total and one regular club, and Sangmu and active-duty service is excluded from the club count. High school and university seasons are not counted toward either achievement.',
        guideCopy.teamAssembly,
        guideCopy.salaryBudget,
        guideCopy.ownerRecords,
        guideCopy.achRewards,
        guideCopy.ownerGrades,
        guideCopy.recordRewards,
        guideCopy.teamSynergy,
        guideCopy.matchReport,
        guideCopy.teamMoments,
        guideCopy.teamDivision,
        'The better a player fits their spot, the higher their fit, and when team synergy turns on through player type combinations, strong foot or players you raised yourself, your team gets stronger in matches. You can play up to 10 matches a day against other owners’ teams (one per opponent per day), and your team rating (RP from service season 2) rises and falls with the results. You can go for the owner ranking by collecting player, team, owner and manager achievements (player achievements run from stage 0 to 6, and team achievements also include Dream Team lineups and Offside Cup results. From season 2, achievements for single-season feats, career shapes and match moments, plus hidden achievements, are added), and you can customize your team logo and share a team intro image.',
      ],
    ],
    [
      'Offside Cup',
      [
        'Each service season, a cup tournament is held between owner teams. You enter on the tournament screen during the registration period, and only teams that fill at least 8 of the 11 starting spots (at least 6 in the Junior division, with youth players filling empty spots) and have not put any starter on the transfer market can take part. The field is 128 teams (64 in the 1st cup), first come first served. From the 3rd cup, a separate tournament is held for each team OVR division (Junior · Senior · Master). The Junior and Senior caps are set when registration opens, at the one-third and two-thirds points of that season’s team OVR distribution, and Master has no limit. You enter a division whose cap is at or above your team OVR, and you play in only one division per cup. At the group draw, if 30 or more teams have entered, the caps are reset by splitting the entered teams’ OVR into thirds, and every team is moved into the division that fits its OVR (with fewer than 30 teams, only teams over the cap move up a division). A division with fewer than 8 teams plays together with the division above it (teams moved up from Junior still take part with Junior eligibility). From the draw until you are eliminated, you cannot change to a lineup that goes over the cap. Teams are split into 32 groups of 4, and the top two in each group go on to a round-of-64 knockout. When the previous cup’s final ends, registration for the next cup opens right away, and owners who can take part are notified. Cup matches are calculated the same way as friendlies, but they are neutral matches with no home advantage, and each match is played only once. Results are decided not by average team OVR but by attack, midfield and defence strength with formation, synergy and manager adjustments added, so the stronger team can still lose. From the 3rd cup, as in ranked matches, strength gaps count for more: when your three lines are 10 points ahead, the odds over 90 minutes are roughly 72% win, 17% draw and 11% loss (up to the 2nd cup it was 62% win, 21% draw and 16% loss). A drawn knockout match goes straight to a penalty shootout with no extra time. Teams that have entered can see the expected win/draw/loss, calculated from the two current lineups, in the next match slot on the tournament screen. Lineups lock 1 hour before a match, and from then on every match in the tournament shows expected win/draw/loss that owners who did not enter can see too. Finished matches keep their pre-match expectation.',
        guideCopy.cupMatches,
        'Depending on your result, you receive player reroll tickets (champion 15 · runner-up 10 · semi-finals 7 · quarter-finals 5 · round of 16 3 · round of 32 2 · round of 64 or group stage 1). Quarter-finalists and above also receive premium scout tickets (champion 3 · runner-up 2 · semi-finals and quarter-finals 1), and semi-finalists and above also receive potential boost tickets (champion 3 · runner-up 2 · semi-finals 1). The 1st cup gave only reroll tickets (champion 10 · runner-up 7 · semi-finals 5 · quarter-finals 3 · round of 16 2 · all others 1). Prediction gives 1 reroll ticket for each match you call correctly, and from the 2nd cup you can receive up to 10 per cup. When you are signed in and creating a new player, you use reroll tickets one at a time on the candidate selection screen to redraw the three candidates. Redrawing discards the current candidates and any potential range you checked with an ad. Semi-finalists and above keep a trophy on their club profile, and the trophy shape and gem color are different for each cup.',
      ],
    ],
    ['Offside League', [guideCopy.league]],
    [
      'Transfer market and club funds',
      [
        `You buy and sell retired player cards in the transfer market on the ${guideCopy.hub} screen. Past-season player cards can be bought and sold too, and starting a past-season player in an owner team uses salary budget. Each card has a base price set from the value of its peak-OVR season, and you can see recent prices for players of the same position and grade in a chart. Market value has a smaller age multiplier from age 30, so a card that reached peak OVR after 30 can have a base price below its top career market value.`,
        'Releasing a player you raised yourself gives you club funds equal to the card’s base price. Club value is your club funds plus the base prices of the player cards you own.',
        'You can lock players you want to keep in the owner team locker room. A locked player cannot be put on the transfer market or released, and both players you raised and players you signed can be locked. Take a player off sale before locking them, and you can unlock from the locker room or from the sell and release screens in the transfer market.',
        `You can buy player reroll tickets with club funds. Buy them in the reroll ticket shop on the ${guideCopy.hub} screen. The price rises each time you buy another one on the same day, and there is a daily purchase limit (starting at ₩10 billion and doubling each time, 3 tickets a day). The price and count reset at 00:00 KST every day. Bought reroll tickets are used together with reroll tickets earned in the Offside Cup. In the app, on top of reroll tickets, you can also watch a rewarded ad to redraw candidates up to 2 times a day.`,
        `In the app you can buy premium scout tickets. Using one at the candidate selection screen draws three new candidates and reveals their potential right away. One of the three is guaranteed A potential or above, and every candidate has twice the normal S chance (three times from season 2). Bought scout tickets can be used on the web too, and the odds by grade are published in the premium scout ticket shop on the ${guideCopy.hub} screen and on the Odds and fairness page. If you use 29 without an S candidate, the 30th is a guaranteed S candidate, and every 100th ticket in total is a guaranteed S candidate with the maximum potential (96); from season 2 these come sooner, with a guaranteed S candidate at the 20th ticket and a maximum-potential S candidate every 70th ticket in total. You can also buy 1 a week with club funds, and receive them for a retired number or as a friend invite reward.`,
        `Records of club funds coming in and going out (releases, sales, signings, reroll ticket purchases, and club funds used instead of ads) are in Club funds history, which opens when you tap club funds on the ${guideCopy.hub} screen.`,
      ],
    ],
    [
      'Card challenges',
      [
        `In Card challenges on the ${guideCopy.hub} screen, you hand in the cards of retired players you raised yourself that meet the conditions. A card you hand in is removed from your club and does not come back, and unlike a release it gives no club funds. Your Hall of Fame and retirement records stay as they are.`,
        'There are three challenges that change every day at 00:00 KST: Easy (1–2 players), Normal (3) and Hard (3–4). You can hand in each challenge once a day, and on a day you hand in all three you receive items such as reroll tickets and potential boost tickets. The amounts are shown on the Card challenges screen. Handing in only some of them gives no reward. Conditions are based only on values printed on the card, such as position, detailed position, peak OVR, nationality (same nationality or all different), longest-played league, season and strong foot.',
        'You cannot hand in players you signed from the transfer market, locked players, players in a manager career or serving as manager, players listed for sale on the transfer market, or players in this season’s starting lineup. Offside Cup squads are inside the starting lineup, so they are blocked too. When you complete all of the daily challenges on 5 days, you receive the permanent title House of Tribute, and on 20 days, Hall of Tribute.',
      ],
    ],
    [
      'Manager career',
      [
        `Signed-in owners with a Google account can start a manager career from Manager career on the ${guideCopy.hub} screen, using a player card they own now (both retired players you raised and players you signed). Once it starts, that card is classed as a manager and removed from this season’s starting lineup, friendly lineups and presets (youth players fill the empty spots), its sale listing is taken down, and it cannot be put on the transfer market, released or locked. Club value drops by the amount that left the lineup. While you are in the Offside Cup, a player in the starting lineup cannot be turned into a manager.`,
        'Only one manager career can be in progress at a time. Your playing record becomes the starting values. Position feeds into manager style, professional seasons and appearances into squad grip, the number of clubs you have been through into adaptability, and the number of titles into board trust, while peak OVR and legend score count only toward fame (the level of your first club). A manager career lasts 8 to 10 seasons. Each season you set the formation (4-3-3·4-4-2·3-5-2), style (attacking, balanced, defensive, counter-attacking) and board target, pick one option in the transfer market, answer 2 to 3 season stories, and then see the review. If you fall short of the target you can be sacked, and you can start over with an offer from another club.',
        'If you give up partway, the card returns to the original player, and you have to put them back in the starting lineup yourself. If you finish, the manager card (formation mastery C to S, style, up to 2 specialties, grade and ending title) is confirmed, and you can start a new manager career with another player. A manager card cannot be traded, but you can sack the manager from the manager screen. If it was a player you raised, you receive club funds equal to the card’s base price, as with a release, and if it was a player you signed, you receive no funds. A manager seated in the manager slot can be sacked after you empty the slot, and a sacked manager cannot be brought back. Manager records and achievements you have already earned stay.',
        'Each owner team has one manager slot. When you seat a finished manager, the mastery for your current formation (S +1.0 · A +0.6 · B +0.3) is added to the three lines of attack, midfield and defence, and the style raises one line while lowering another slightly. A specialty adds its bonus only when its matching team synergy is on (Youth development gives midfield and defence +0.5, and the others give +1 to one line). Even if several matching synergies are on, each specialty is added only once. Variant shapes such as 4-2-3-1 use the mastery of their base formation (4-3-3·4-4-2·3-5-2). The adjustment for each line stays between −1.5 and +3.0, so a total over the limit is cut off (the manager slot adjustment breakdown on the team screen shows the value for each source and the amount cut off), and between equally strong teams even the best manager raises the win rate by less than 5 percentage points. With the manager slot empty, matches play out as before. While the cup lineup is locked, the manager cannot be changed either. Manager careers have no paid items.',
      ],
    ],
    [
      'Friends and friendlies',
      [
        'Owners can become friends through a friend request on a team profile, a friend code or an invite link. You can play up to 10 friendlies a day against a friend’s team. Friendlies do not count toward rating, record or achievements, and only your head-to-head record against that friend is kept.',
        'Friend invite event: when an owner who has not yet retired any player sends a friend request using a friend’s invite link or friend code, it is recorded as an invite. When that owner finishes a player career through to retirement, both of you receive 3 player reroll tickets and 1 premium scout ticket. A person can be invited only once, and the inviter’s reward is limited to 10 times. You can see invite progress on the Friends screen.',
      ],
    ],
    [
      'Daily check-in',
      [
        'Signed-in owners can stamp once a day in the check-in window on Home and receive that day’s reward. The window pops up on Home once a day, and after you close it you can reopen it from the check-in row on Home. A day changes at 00:00 KST. Stamps collect on a 28-slot stamp board and do not disappear when days are not consecutive; when you fill all 28, a new board starts.',
        'Each slot has a reward. On a normal day it is 1 player reroll ticket; slots 4 · 11 · 18 · 25 give 1 potential boost ticket, slot 7 gives 2 potential boost tickets, slot 14 gives 1 premium scout ticket, slot 21 gives 3 potential boost tickets, and slot 28 gives 2 premium scout tickets, 3 potential boost tickets and 1 player rename ticket. Filling a whole board gives 20 reroll tickets, 12 potential boost tickets, 3 premium scout tickets and 1 player rename ticket.',
        'Your streak continues even if you miss up to one day a week (Monday to Sunday), and if you miss two or more days it counts again from day 1. When you are not signed in you can only see the stamp board, and once you sign in you can check in right away. If a signed-in owner with notifications on in the app has not checked in that day, a check-in reminder is sent once at around 19:00 KST. If you keep skipping days, it is sent only up to three times, and it resumes once you check in again.',
      ],
    ],
    [
      'Season pass',
      [
        'From season 2, signed-in owners can buy a season pass in the app or on the web (₩9,900, one season, no auto-renewal). You get the stage 1 reward as soon as you buy, and stages open up to stage 14 based on how many players retire after playing to age 35 or older that season. Up to 20 retirements a day are counted. Even if you buy partway through the season, counting starts from the beginning of that season. You can see your progress in the Season pass on the My Club screen even if you have not bought the pass.',
        'Each stage gives reroll tickets, potential boost tickets and premium scout tickets. The base stages go up to 25 retirements, with bonus stages at 30, 40 and 50. Opening all 14 stages gives 59 reroll tickets, 65 potential boost tickets, 14 premium scout tickets and 2 player rename tickets. Tapping Claim collects the rewards for all the stages that are open at once, and you can claim on the web too. Buying one more in the same season becomes the next season’s pass. If you refund the payment, the pass closes and the items you received are taken back as far as you still have them.',
      ],
    ],
    [
      'Club membership',
      [
        'Club membership is a ₩4,900 monthly subscription you join in the app and it renews automatically every month. While you are subscribed, you get double check-in rewards, 1 extra potential boost ticket each time you check in, no app ads (rewarded ads give their reward right away without an ad), and a supporter badge next to your name on your club and in your friends list. With the same owner account, the check-in benefits and badge apply on the web too. On the web you can buy a 30-day pass (₩4,900) that does not renew; buy again while it is active and 30 more days start when the current ones end.',
        'You cancel in the subscription management of the App Store or Google Play. After you cancel, the benefits continue until the period you already paid for ends. On another device, tap Restore purchase on the membership screen with the same store account to bring it back. Remove Ads you already bought stays even after the membership ends. Owners who bought Remove Ads before the membership launched (before November 1, 2026) get a one-time thank-you gift of 5 potential boost tickets and 5 reroll tickets in the Home gift slot.',
      ],
    ],
    [
      'Player rename tickets',
      [
        'Signed-in owners can change the name of one of their players with 1 player rename ticket. For a player in progress, use the pencil next to the name on the player screen; for retired players and players signed from the transfer market, use Manage player on the My Players screen. Names can be up to 12 characters, and links and profanity are not allowed.',
        'A changed name is shown in the Hall of Fame, the transfer market and club matches. A name hidden after a report cannot be changed. You receive 1 rename ticket at check-in slot 28, and you can buy them in a pack of 5 in the app store.',
      ],
    ],
    [
      'Service seasons',
      [
        'Rankings and records in the Records room are counted separately for each service season. Season 1 opened on October 6, 2026, and players created before that remain as pre-season records. Which season a player belongs to is decided by the time their first season record was uploaded to the server, and it does not change when the next season opens. In a new season you build a new owner team. The player cards, club funds and items you own carry over, and past-season player cards can still be bought and sold in the transfer market.',
        'The length of a season is not fixed by date but set by the season progress that players fill together. Careers that retire after playing to age 35 or older fill the progress, and there is a limit on how much one person can add in a day. When progress reaches 90%, a closing time is set and the time left is shown on Home. A season lasts at least 2 weeks and at most 25 days, and if the Offside Cup has not finished yet, it continues until 00:00 KST the day after the final. The next season opens right at the closing time.',
      ],
    ],
  ];
  const items = [
    [
      'Is the estimated finish shown on a transfer offer the current standing?',
      guideCopy.transferPreview,
    ],
    ['When do dating rumor events appear?', guideCopy.datingRumor],
    ['How is the salary of past-season players decided?', guideCopy.salaryBudget],
    ['What is expected goals (xG) in the match report?', guideCopy.matchReport],
    ['What are the choices that appear during ranked matches?', guideCopy.teamMoments],
    ['How is the match rating decided?', guideCopy.ratingParts],
    ['What are the choices that appear during match commentary?', guideCopy.keyMoment],
    ['Can I go out on loan?', guideCopy.loan],
    ['How do ranked match RP and divisions go up and down?', guideCopy.teamDivision],
    ['How do I earn permanent titles in the Hall of Honors?', guideCopy.ownerRecords],
    ['Can I retire only from the national team?', guideCopy.ntRetirement],
    [
      'Does it still count as long service if I transfer to another team and come back?',
      'When a player you raised retires after 10 or more cumulative seasons at one regular club, you earn the Long service achievement. Seasons before and after a return are added together, but seasons of different players are not combined. If you have a career at another regular club, you are not a one-club man. Sangmu and active-duty service periods are not added to the original club’s long service seasons.',
    ],
    [
      'How is the Wall of Honour title different from a retired number?',
      'The Wall of Honour is a title given to a player who met the retired number requirements but whose candidate clubs’ numbers were all retired first. You do not receive the number as a retired number, and there is no reward that raises score or club value. You change your featured title yourself in the list of titles you have received. For existing players, it applies only when the conditions at retirement can be confirmed from server records.',
    ],
    [
      'What are the check-in rewards?',
      'When a signed-in owner checks in once a day, a stamp is added to the 28-slot stamp board and you receive that slot’s reward each day. On a normal day it is 1 player reroll ticket, and on set slots you receive potential boost tickets or premium scout tickets. Stamps stay even if you miss a day. If you are not signed in, you can sign in with the sign-in button in the check-in window and then claim. In the app, we send a notification in the evening on days you have not checked in.',
    ],
    [
      'Can I change a player’s name?',
      'With 1 player rename ticket you can change the name of a player in progress, one of your retired players, or a player you signed from the transfer market. You need to be signed in, and the changed name is shown in the Hall of Fame and the transfer market. You receive a ticket at check-in slot 28 or buy a pack of 5 in the app. A name hidden after a report cannot be changed.',
    ],
    ['How are the Offside Cup and the league different?', guideCopy.leagueFaq],
    [
      'What are Offside Cup reroll tickets used for?',
      'When you are signed in and creating a new player, you use them one at a time with “Redraw candidates” on the candidate selection screen. It draws three new candidates, and the current candidates and any potential range you checked with an ad are discarded. You receive them based on your cup result, and they are deducted on the server when used, so the remaining count is the same even if you switch devices. Every time you use 30 reroll tickets you receive 1 premium scout ticket, and the number left until the next one is shown on the candidate selection screen.',
    ],
    [
      'Can I use club funds instead of ads?',
      'Yes. Signed-in owners can use club funds to see candidate potential, see the season review, and for Potential Boost (the one try in a season when you are short of funds and extra tries after that). In the app you choose between an ad and club funds, and on the web, which has no ads, you receive them with club funds. The more times you receive the same reward on the same day, the higher the price, and there is a daily limit on how many you can receive (Potential Boost has no limit on count, only the price rises). Everything resets at 00:00 KST every day. The odds and results are the same as when you receive them with an ad, and club funds you spend cannot be returned and remain in Club funds history. On the Potential Boost screen you can also get a guaranteed boost with club funds that raises one stage with no chance involved (once per player, up to 3 a day).',
    ],
    [
      'Can I buy reroll tickets with club funds?',
      `Yes. Buy them in the reroll ticket shop on the ${guideCopy.hub} screen. The more you buy on the same day, the higher the price, and there is a daily purchase limit; both reset at 00:00 KST every day. Bought reroll tickets and club funds you spend cannot be returned. When you have no reroll tickets, tapping the shop notice on the candidate selection screen takes you straight to the shop.`,
    ],
    [
      'What do I get for inviting a friend?',
      'When a friend who has not yet retired any player sends a friend request with your invite link or friend code and finishes a player career through to retirement, both of you receive 3 player reroll tickets and 1 premium scout ticket. The reward goes to signed-in owners, and the inviter can receive it up to 10 times. The items you receive are used the same way as other items.',
    ],
    [
      'Is there a faster way to get an S potential player?',
      `Use premium scout tickets sold in the app. Using one at the candidate selection screen draws three new candidates and reveals their potential right away. One of the three is guaranteed A potential or above, and every candidate has twice the normal S chance (three times from season 2). The odds by grade are published, with the values currently in effect, in the shop on the ${guideCopy.hub} screen and in View odds on the candidate selection screen. They go to your signed-in owner account, and bought scout tickets can be used on the web too. If you use 29 without an S candidate, the 30th is a guaranteed S candidate, and every 100th ticket in total is a guaranteed S candidate with the maximum potential (96); from season 2 these come sooner, with a guaranteed S candidate at the 20th ticket and a maximum-potential S candidate every 70th ticket in total. You can buy 1 a week with club funds, and you also receive 1 each for the first career to earn a retired number and for friend invite rewards.`,
    ],
    ['Can I watch an ad to redraw candidates?', guideCopy.adReroll],
    [
      'My OVR is not rising much. How do I raise it?',
      'OVR is a weighted sum of detailed attributes set for each position. The underlined attributes on the player creation screen are the main OVR items for that position. Growth depends on age, how much room is left up to potential, and morale, and younger players grow more (early developer and late bloomer traits differ in the ages at which they grow most). It is best to raise the main OVR attributes evenly in training. If one attribute gets too far ahead of the other main attributes, training growth shrinks, and when you pick a training the description below it shows the reduced rate. If you only train attributes that count little toward OVR, OVR hardly rises. A Target man striker also raises OVR through heading, strength and jumping, and a Winger-type wide midfielder through pace. Attributes also rise through match appearances and events.',
    ],
    [
      'My OVR does not rise all the way to potential.',
      'Potential is not a cap on OVR but a measure of growth speed. The closer OVR gets to potential, the slower it grows (it keeps growing a little even after reaching potential), and growth shrinks as you age. Usually from age 31 (32 for late bloomers, 3 years later for goalkeepers), pace and physical start to fall first. Players created before October 21, 2026 keep following the old rule (early developer 30, late bloomer 33). A successful Potential Boost increases the room left, so you grow quickly again. From the season your attributes start to decline, you can reduce that season’s end-of-season decline with career funds in Body care on the Player tab (basic care 30% · intensive care 55% · dedicated medical team 75%, once per season). The cost scales with salary and rises the further you are from your peak age.',
    ],
    [
      'What are the main attributes for each position?',
      'The “Main OVR attributes” on the player creation screen show the attributes that carry the most weight for the detailed position you chose. For example, an attacking midfielder weighs dribbling, passing and shooting heavily, a central midfielder passing and dribbling, and a defensive midfielder defending and passing.',
    ],
    [
      'What do height and weight change?',
      'When you create a player, they raise or lower detailed attributes such as heading, jumping, strength, acceleration and agility slightly. Starting OVR is then readjusted, so starting OVR is the same even with a different build. They have no effect on growth, matches or events after creation.',
    ],
    ['Do the first three candidates change if I refresh?', guideCopy.candidateRefresh],
    [
      'Do foreign players have military service too?',
      'No. Military service applies only to players with South Korean nationality. Players with a foreign nationality do not receive an enlistment offer, and military service shows as “Not applicable.”',
    ],
    ['How is the season Best XI chosen?', guideCopy.best11],
    ['When does an era rival appear?', guideCopy.eraRival],
    [
      'How do I get a retired number?',
      `${guideCopy.retiredNumber} ${guideCopy.retiredNumberContribution} ${guideCopy.retiredNumberProgress}`,
    ],
    [
      'Which club counts for the “All 11 from the same club” achievement?',
      'It is the last club each player played for when they retired. It looks at the club right before retirement, not the first club or the one they played longest for. All 11 spots must be filled, with no empty spots or youth players. If all 11 players played at least one season at the same professional club during their careers, regardless of their retirement club, you receive the “All 11 have played for the same club” achievement. High school, university and military seasons are not counted.',
    ],
    [
      'What do the player card colors mean?',
      'They are card grades. A legend score of 1,800 or more is Icon (navy), 1,100 or more is Legend (dark green), and below that cards are split by peak OVR into Elite (85 or more), Gold (75 or more), Silver (65 or more) and Bronze. A pale light-green card is a youth player filling an empty spot.',
    ],
    [
      'What changes if I buy Remove Ads?',
      'Buying it once in the app settings removes banner ads and the interstitial ad that appears at retirement, and rewarded ads (seeing candidate potential, seeing the season review, Potential Boost, redrawing candidates) give their reward right away without an ad. Odds and count limits stay the same (redrawing candidates with an ad is 2 a day, and extra Potential Boost tries are 2 per player). It does not include reroll tickets, premium scout tickets or potential boost tickets, and how you use those items does not change either. You cannot buy it on the web yet. With the same store account, you can bring it back on another device with Restore purchase in settings.',
    ],
    [
      'What is the season pass?',
      'It is a one-season reward pass you buy in the app or on the web from season 2 (₩9,900, no auto-renewal). You get the stage 1 reward as soon as you buy, and stages open up to stage 14 based on the number of players who retire after playing to age 35 or older that season (up to 20 a day), and each stage gives reroll tickets, potential boost tickets and premium scout tickets. Even if you buy partway through the season, counting starts from the beginning of that season, and open rewards can be claimed on the web too.',
    ],
    [
      'What are the club membership benefits?',
      'It is a ₩4,900 monthly auto-renewing subscription you join in the app. While you are subscribed, check-in rewards are doubled, you get 1 extra potential boost ticket each time you check in, ads are removed, and a supporter badge appears next to your name. You cancel in your store subscription management, and after you cancel the benefits continue until the period you paid for ends. On the web you can buy a 30-day pass that does not renew.',
    ],
    [
      'Where do I buy premium scout tickets and potential boost tickets?',
      `Buy them in the shop at the bottom of the ${guideCopy.hub} screen. Reroll tickets can be bought with club funds on both web and app, premium scout tickets can be bought with club funds once a week, and paid products (bundles of reroll tickets, premium scout tickets and potential boost tickets) are bought with store payment in the app, or with web payment on the web by signed-in owners. Items you buy go to your owner account and can be used on the web too. Use reroll tickets and premium scout tickets at the candidate step when creating a player, and potential boost tickets in Potential Boost on the Player tab.`,
    ],
    [
      'How are player types like Speedster and Stopper decided?',
      'They are decided by the combination of the two focus attributes you pick when creating a player, and they do not change when you raise attributes. Within the same position, each focus combination has a set type, and the type is used for the duo synergy conditions of an owner team (a synergy turns on only when both the type and the lineup spot match). You can see the type and synergy for each combination in the Player type guide on the player creation screen and in the Odds guide.',
    ],
    [
      'Is the player type a random draw?',
      'No. It is set to the type closest to the two focus attributes you picked when creating the player. For example, a goalkeeper with kicking among their focus attributes but not handling becomes a Sweeper keeper, and picking kicking and handling together makes The wall. Card color (grade) is decided by legend score and peak OVR regardless of type (see “What do the player card colors mean?” above).',
    ],
    [
      `I retired, but my player is not on the ${guideCopy.hub} screen.`,
      'Your retirement record has to be uploaded to the server before the player appears in the locker room. If your connection is unstable or a very large number of records are uploaded in a short time, it can be delayed briefly, and in the meantime the owner team screen shows a notice that records are being uploaded. If you keep the game open it uploads again automatically, and the player appears in the locker room as soon as it goes through. Your records stay on your device, so do not clear your saved data in the meantime.',
    ],
    [
      'What kind of game is this?',
      'It is a story simulation where you build one player’s career from the final year of high school to retirement, through training and event choices each season.',
    ],
    [
      'Where is my progress saved?',
      'The save you are playing (player attributes, the season in progress and so on) stays only in this browser’s local storage. If you clear the storage, the save is gone. Before you switch devices, export a backup code or file in Settings, and you can import it on the new device to carry on. Do not send your backup code to anyone. Career and season summary records and choice records are, however, also saved on the server (Cloudflare D1) by anonymous profile and used for service improvement and balance analysis. ' +
        guideCopy.publicRetirement +
        ' ' +
        NAME_POLICY +
        ' If you delete your account, these records are deleted with it.',
    ],
    [
      'Why is there Google and Apple sign-in?',
      'If you sign in with Google or Apple, you use the same owner account and public records on other devices. A game in progress is not moved automatically. Linking or unlinking an account, or signing out, leaves the game save data on this device as it is.',
    ],
    [
      'How are event success chances decided?',
      'For an option that shows a percentage, that percentage is the real chance of success, and it is decided by the same rule for every player with no hidden adjustment. Options with a timing gauge, such as penalty kicks, one-on-ones and shootouts, are decided by where you stop the needle instead of a percentage (with Reduce motion on, they are decided by the displayed chance). Options with no chance shown have a fixed outcome, and the reward may be lower.',
    ],
    ['Do odds change if I watch ads or pay?', guideCopy.paidOdds],
    [
      'Does the operator ever change the odds?',
      'Balance numbers such as growth, injury and event chances can be adjusted during live service. Adjustments apply with the same value to all players, not to specific ones, and are recorded as versions. They apply to careers in progress from the start of the next season, and to newly created careers right away.',
    ],
    [
      'Can I change how my player looks?',
      'When you create a player, you can choose skin tone, hair color and hairstyle for free. Tap the pixel player on the career screen to buy customization items with career funds. Items you buy once can be changed for free during that career, and when you earn titles such as Top scorer or Ballon d’Or you can also buy golden record items. Existing retired players can also change only their look for free in the retirement report. Records, attributes and career funds stay as they are.',
    ],
    ['How long is a service season?', guideCopy.seasonLength],
    [
      'Can I stop myself from selling or releasing a favorite player by mistake?',
      'In the owner team locker room, tap Lock under the player card. A locked player cannot be put on the transfer market or released. Take a player off sale before locking them, and you unlock from the locker room or from the sell and release screens in the transfer market.',
    ],
    [
      'Can I load save data from an older version?',
      'Save data from past versions is converted to the latest format automatically when you load it.',
    ],
    [
      'I have a problem.',
      'Please send your environment and the screen where the problem happened to <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a>.',
    ],
    [
      'What do I do with spare retired player cards?',
      `Players you raised can be released for club funds or sold in the transfer market, and you can also hand them in for Card challenges on the ${guideCopy.hub} screen. Three challenges open every day at 00:00 KST, and on a day you hand in all three you receive items such as reroll tickets and potential boost tickets. Cards you hand in do not come back. Players you signed, locked players and players in this season's starting lineup cannot be handed in.`,
    ],
    [
      'Can I turn a retired player into a manager?',
      `Yes. Signed-in owners with a Google account can run an 8 to 10 season manager career from Manager career on the ${guideCopy.hub} screen, using a player card they own now. While it is in progress, that player is removed from the starting lineup and cannot be sold, released or locked, and if you give up they return as the original player. A manager who finishes can be seated in the manager slot of your owner team and gives a small adjustment to the attack, midfield and defence lines. Only one manager career can be in progress at a time, and once it ends you can start again with another player.`,
    ],
  ];
  return {
    namePolicy: NAME_POLICY,
    siteName: 'OFFSIDE',
    guide: {
      title: 'Game guide',
      description:
        'Learn about OFFSIDE (Full Time) from creating a player through season flow, growth, transfers, military service, retirement and the Hall of Fame, to owner teams and the transfer market.',
      lead: 'How to play one player’s career from the final year of high school to retirement, and how to build an owner team from your retired players.',
      sections,
      saveTitle: 'Saving your progress',
      /** privacy: link (<a>) to the privacy policy. */
      saveNote: (privacy) =>
        `Do not send your backup code to anyone. Career and season summary records and your choices while playing are, however, also saved on the server by anonymous profile for service improvement and balance analysis. ${guideCopy.publicRetirement} ${NAME_POLICY} For details, see the ${privacy}.`,
      start: 'Start your first career',
    },
    faq: {
      title: 'Frequently asked questions',
      description:
        'Check how OFFSIDE (Full Time) saves your progress, links accounts, how to play and how to contact support before you play.',
      lead: 'Answers you need when starting or continuing the game.',
      items,
    },
    ui: {
      topicArticles: 'Strategy articles by topic',
      otherArticles: 'More strategy articles',
      start: 'Start game',
      home: 'Home',
      app: 'Get the app',
      guide: 'Game guide',
      faq: 'FAQ',
      fairness: 'Odds and fairness',
      legends: 'Hall of Fame',
      privacy: 'Privacy policy',
    },
  };
};
