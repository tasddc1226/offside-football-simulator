import type { Translation } from '../core';
import type { GlossaryMsgs } from '../ko/glossary';

export const glossary: Translation<GlossaryMsgs> = {
  title: 'Glossary',
  intro: 'The numbers and football terms in the game, one line each.',
  more: 'See the full glossary',
  close: 'Close',
  help: (p) => `What does ${p.term} mean?`,
  sheetLabel: 'Term explained',
  g_numbers: 'Game numbers',
  g_positions: 'Positions',
  g_match: 'Matches and records',
  g_squad: 'Squad and contracts',
  g_comps: 'Leagues and competitions',
  g_career: 'Career',
  g_owner: 'Club owner',
  t_ovr: 'OVR',
  d_ovr:
    'Your overall rating. Each position weighs different attributes, so the same player has a different OVR in another position. A higher OVR means better matches and offers from bigger clubs.',
  t_potential: 'Potential',
  d_potential:
    'A hidden value that sets how far a player can grow. It moves up and down a little until age 25, and the real grade is revealed at retirement. S is the highest grade and very rare.',
  t_condition: 'Condition',
  d_condition:
    'How fit the player is. Matches and training lower it and rest brings it back. When it is low, injuries become more likely and starting gets harder.',
  t_morale: 'Morale',
  d_morale:
    'How confident and happy the player feels. Higher morale means better performances and more growth from training. Losses and missed games lower it.',
  t_fame: 'Fame',
  d_fame:
    'How well known the player is. Higher fame helps with national team call-ups, transfer offers and ad deals. Trophies and individual awards raise it.',
  t_rating: 'Rating',
  d_rating:
    'A score for how well you played in one match. It runs from 4.5 to 10. Around 6.8 is average and above 8 is an excellent game.',
  t_legendScore: 'Legend score',
  d_legendScore:
    'A score for the whole career, given at retirement. It grows with career totals like appearances, goals, assists and clean sheets, plus trophies and individual awards.',
  t_posFW: 'Forward',
  d_posFW:
    'Plays near the opponent’s goal and scores. A striker finishes in front of goal and a winger runs down the flank to cross.',
  t_posMF: 'Midfielder',
  d_posMF:
    'Links attack and defense in the middle of the pitch. An attacking midfielder plays the pass before a goal and a defensive midfielder breaks up attacks in front of the defense.',
  t_posDF: 'Defender',
  d_posDF:
    'Stops attacks in front of your own goal. A center-back handles headers and physical duels in the middle, and a fullback guards the flank and joins attacks too.',
  t_posGK: 'Goalkeeper',
  d_posGK:
    'The last line of defense in goal. The only player allowed to use their hands, so their attributes have their own names like reflexes, diving and handling.',
  t_assist: 'Assist',
  d_assist: 'The final pass to the player who scored.',
  t_cleanSheet: 'Clean sheet',
  d_cleanSheet:
    'A match where your team concedes no goals. An important record for goalkeepers and defenders.',
  t_hatTrick: 'Hat-trick',
  d_hatTrick: 'Three goals by one player in a single match.',
  t_mom: 'MOM',
  d_mom: 'Man of the Match. The one player who played best in that match.',
  t_topScorer: 'Top scorer · Top assister',
  d_topScorer:
    'Awards for the players with the most goals and assists in league matches over a season.',
  t_offside: 'Offside',
  d_offside:
    'A foul when an attacker is closer to goal than the last defender (not counting the goalkeeper) at the moment the pass is played.',
  t_starter: 'Starter',
  d_starter:
    'A player who plays from kickoff. A guaranteed starter role in your contract means plenty of games.',
  t_rotation: 'Rotation',
  d_rotation: 'A player who takes turns with the starters. Some games you start, some you rest.',
  t_bench: 'Bench',
  d_bench:
    'Waiting to come on as a substitute. Fighting for a place means you have to earn your minutes.',
  t_contract: 'Contract · Salary',
  d_contract:
    'An agreement on how many years you stay at a club. Salary is what you earn per year. Near the end of a contract you renew or move to another club.',
  t_transfer: 'Transfer · Transfer fee',
  d_transfer:
    'Moving to another club. The transfer fee is what the buying club pays your old club.',
  t_loan: 'Loan',
  d_loan:
    'Playing for another club for a while without leaving your own. Your salary and contract stay with your parent club. Players usually go on loan to get game time.',
  t_league: 'League',
  d_league:
    'The same teams play each other several times over a season and rank by points. A win is 3 points, a draw 1, and first place wins the league.',
  t_promotion: 'Promotion · Relegation',
  d_promotion:
    'Leagues are split into tiers like a first and second division. A good season moves a team up (promotion) and a bad one moves it down (relegation).',
  t_cup: 'Cup',
  d_cup:
    'A knockout tournament where a loss sends you out. It runs alongside the league and lower-league teams take part too.',
  t_ucl: 'Champions League',
  d_ucl:
    'The top clubs from each European league compete here. The biggest stage in club football.',
  t_national: 'National team · Caps',
  d_national:
    'The national team plays for the country, and official matches between national teams count as caps. Playing well for your club and high fame make a call-up more likely.',
  t_worldCup: 'World Cup · Continental cup',
  d_worldCup:
    'The World Cup is the tournament between countries held every four years. Continental cups like the Asian Cup and the Euros are held within each continent.',
  t_military: 'Military service · Sangmu',
  d_military:
    'Korean players have to do military service. If accepted by Gimcheon Sangmu, you serve for two seasons while playing in the K League.',
  t_exemption: 'Military exemption',
  d_exemption:
    'An Asian Games gold medal or an Olympic bronze or better exempts you from military service.',
  t_ballon: 'Ballon d’Or',
  d_ballon: 'The individual award for the best footballer of the year.',
  t_hof: 'Hall of Fame',
  d_hof:
    'Where retired players’ records are kept. You can compare legend scores and career totals with other players’ careers.',
  t_retiredNumber: 'Retired number',
  d_retiredNumber:
    'A club keeps a legend’s shirt number so no one else can wear it. You can earn one by setting big records at a single club.',
  t_ownerTeam: 'Owner team',
  d_ownerTeam: 'Your own team built from retired players. It plays against other owners’ teams.',
  t_market: 'Transfer market',
  d_market:
    'In real football it is the period when clubs buy and sell players. In this game, owners buy and sell retired players with club funds in the transfer market.',
  t_release: 'Release',
  d_release:
    'Letting a player go from the team. In this game, releasing a player from your owner team gives you club funds.',
  t_funds: 'Club funds',
  d_funds:
    'The money your owner team spends. Use it to buy players in the transfer market or items in the shop.',
};
