import type { Translation } from '@offside/contracts/i18n';
import type { gBigStageText } from '../ko/gBigStage';
import { tn } from '../names';

// 연맹별 대륙컵 이름(national.ts CONT_CUP와 같은 대회).
const CONT_CUP: Record<string, string> = {
  AFC: 'the AFC Asian Cup',
  UEFA: 'the UEFA European Championship',
  CONMEBOL: 'the Copa América',
  CAF: 'the Africa Cup of Nations',
  CONCACAF: 'the CONCACAF Gold Cup',
  OFC: 'the OFC Nations Cup',
};

// 월드컵에서 간 단계(NatTour.stage 저장값) → 문장 조각.
const WC_DEEP: Record<string, string> = {
  '8강': 'reaching the quarter-finals', // i18n-ignore 저장값 키
  '4강': 'reaching the semi-finals', // i18n-ignore 저장값 키
  준우승: 'reaching the final', // i18n-ignore 저장값 키
  우승: 'winning it', // i18n-ignore 저장값 키
};

export const gBigStage: Translation<typeof gBigStageText> = {
  wc1Title: 'A World Cup year',
  wc1Text: (p) =>
    `The ${p.year} FIFA World Cup is this summer. The national team manager told reporters, "The final squad will be picked on second-half form." Your name is on the list of candidates in the papers.`,
  wc1PushLabel: 'Give everything in every match with the World Cup in mind',
  wc1PushOk:
    'You did not sit out a single match in the first half of the season. A national team coach in the stands wrote your name in his notebook.',
  wc1PushFail:
    'You pushed too hard and your hamstring tightened. You flicked through World Cup stories from a bed in the medical room.',
  wc1PaceLabel: 'Focus on club matches and manage your body',
  wc1PaceOk:
    'You managed your training load through the season. The manager kept picking you because you were always ready.',

  wc2Title: 'A week before the squad',
  wc2Text:
    'A league match a week before the final squad is announced. The opposing defenders are flying into tackles from the start. A national team coach is sitting in the stands.',
  wc2FightLabel: 'Stand your ground and take them on',
  wc2FightOk:
    'You won the physical battle and played the full match. Afterwards the national team coach came down to the dressing room door to shake your hand.',
  wc2FightFail:
    'A tackle twisted your ankle. As you were carried off on a stretcher, the national team coach stood up in the stands.',
  wc2SafeLabel: 'Release the ball quickly and protect yourself',
  wc2SafeOk:
    'You played it on one touch and finished the match unhurt. The manager said only, "You held back today."',

  wc3TitleHero: 'After the World Cup',
  wc3TextHero: (p) =>
    `You are back from the World Cup after ${WC_DEEP[p.stage] ?? 'a long run'}. The arrivals hall is packed with reporters and fans. The microphones crowd in on you.`,
  wc3TextSquad:
    'You are back after playing at the World Cup. Reporters are waiting in the arrivals hall. The microphones crowd in on you.',
  wc3TextMissed:
    'You watched the World Cup on TV. After the first pre-season session, reporters ask about being left out of the squad.',
  wc3TalkLabel: 'Speak openly about the tournament',
  wc3TalkOk:
    'You talked about what happened behind the scenes and your goal for the next World Cup. The next day your photo was on the front of the sports pages.',
  wc3TalkFail:
    'One remark about the manager’s tactics became the headline. A national team official phoned the club.',
  wc3BackLabel: 'Say a few words and head to club training',
  wc3BackOk:
    '"Now I am focused on my club." The next morning you were the first to arrive at the training ground.',

  paradeTitle: 'Victory parade',
  paradeText:
    'The national team is home with the trophy. An open-top bus parade is ready in the city square. Your club reminds you that pre-season training starts tomorrow.',
  paradeRideLabel: 'Stand at the front of the parade bus',
  paradeRideOk:
    'You held the trophy high on top of the bus. The celebrations ran until dawn, and you arrived late to training the next day.',
  paradeSkipLabel: 'Wave to the crowd and head back to your club',
  paradeSkipOk:
    'You waved to the fans and went straight to the airport. The next morning you walked into training still wearing the medal, and your teammates applauded.',

  restTitle: 'The summer after the tournament',
  restText:
    'You spent the whole summer at a tournament with the national team. Two weeks of holiday are left. Your teammates have already started pre-season training.',
  restFullLabel: 'Take the full holiday',
  restFullOk:
    'You did not touch a ball for two weeks. At your first session, joining late, your legs felt light.',
  restEarlyLabel: 'Cut the holiday short and join now',
  restEarlyOk:
    'You were back at the training ground after three days. The manager put you in the starting line-up for the first friendly.',
  restEarlyFail:
    'Your body had not recovered. You went down clutching your calf in the first friendly.',

  contEveTitle: 'Early call-up',
  contEveText: (p) =>
    `This summer it is ${CONT_CUP[p.conf] ?? CONT_CUP.AFC!}. The national team wants you in camp for the last week of the league season. Your club still has two league matches to play.`,
  contEveGoLabel: 'Answer the early call-up',
  contEveGoOk:
    'You checked into the national team camp before the final league match. Your club manager did not mention your name at his press conference.',
  contEveStayLabel: 'Play to the last league match, then join',
  contEveStayOk:
    'You wore your club shirt until the final match. You arrived at the national team camp three days late.',

  oaTitle: 'Over-age offer',
  oaText: (p) =>
    `The ${p.olympic ? 'Olympic' : 'Asian Games'} team manager wants you as an over-age player. Only three players above the age limit can be picked. The tournament overlaps with pre-season.`,
  oaMilText: (p) =>
    p.olympic
      ? 'A bronze medal or better would also bring a military service exemption.'
      : 'A gold medal would also bring a military service exemption.',
  oaAcceptLabel: 'Persuade the club and accept',
  oaAcceptOk:
    'The club said, "Just don’t get hurt," and let you go. Your name went on the bottom of the squad list.',
  oaAcceptFail: 'The club said you could not miss pre-season and would not let you go.',
  oaDeclineLabel: 'Turn it down and prepare for the club season',
  oaDeclineOk:
    'You said the places should go to younger players. The manager named you as a captaincy candidate for next season.',

  galaTitle: 'Ballon d’Or night',
  galaText: (p) =>
    p.rank === 1
      ? 'The Ballon d’Or ceremony is in Paris. This year’s winner is you. The ceremony is two days before a weekend league match.'
      : `The Ballon d’Or ceremony is in Paris. Your name will be read out in ${p.rank}th place. The ceremony is two days before a weekend league match.`,
  galaGoLabel: 'Put on a tuxedo and fly to Paris',
  galaGoOk:
    'Dozens of cameras turned to you on the red carpet. You barely slept on the flight home after midnight.',
  galaSkipLabel: 'Skip the ceremony and prepare for the weekend',
  galaSkipOk:
    'You sent a video message and stayed at the training ground. The day before the match, the manager patted you on the shoulder.',

  anthemTitle: 'Champions League night',
  anthemText:
    'Your first Champions League match. As you walk out of the tunnel, the starball banner unfolds over the centre circle and the anthem plays. Your legs tremble a little.',
  anthemListenLabel: 'Close your eyes and take in the anthem',
  anthemListenOk:
    'When the anthem ended, the shaking stopped. The ball stuck to your feet from the first touch, and the TV cameras followed you all night.',
  anthemListenFail:
    'Your heart was still racing after the anthem. Your first pass went straight to an opponent, and the manager got up from the bench.',
  anthemRoutineLabel: 'Keep your earphones in and warm up as usual',
  anthemRoutineOk:
    'You warmed up the way you always do and went into the match. You got through 90 minutes without a mistake.',

  awayTitle: 'A hard away trip',
  awayText: (p) =>
    p.key === 'LIB'
      ? 'A Copa Libertadores away match. The stadium is 3,600m above sea level, and a few strides leave you short of breath.'
      : p.key === 'CCC'
        ? 'A CONCACAF Champions Cup away match. Mexico City sits 2,200m up, and 80,000 fans are whistling before kick-off.'
        : 'An AFC Champions League away match. After a nine-hour flight, it is still 35 degrees at the 9pm kick-off.',
  awayPressLabel: 'Press hard from the start',
  awayPressOk:
    'Twenty minutes of pressing produced the opening goal. The travelling fans sang until the final whistle.',
  awayPressFail:
    'Your legs were heavy after half an hour. In the second half you could not even chase the ball.',
  awayKeepLabel: 'Keep the ball and save your legs',
  awayKeepOk: 'You passed it around patiently and held on. You came home with a point from a draw.',

  medalTitle: 'Runners-up medal',
  medalText: (p) =>
    `You lost the ${tn(p.comp)} final. Runners-up medals are hung around each player’s neck below the podium. Right next to you, the winners’ celebrations begin.`,
  medalWearLabel: 'Wear the medal and applaud the winners',
  medalWearOk:
    'You shook hands with the opposing players with the medal around your neck. The TV cameras stayed on that scene for a long time.',
  medalOffLabel: 'Take the medal off straight away',
  medalOffOk:
    'You pulled the medal off and walked into the dressing room with it in your hand. Fans shared the photo, saying, "Next time it’s gold."',
  medalOffFail:
    'The TV cameras caught you taking the medal off. The next day the papers were full of stories about bad sportsmanship.',

  deadlineTitle: 'Deadline day',
  deadlineText:
    'Transfer deadline day, 9pm. Your agent is on the phone. A club from a league a level up has made a late offer, and the paperwork has to reach the league office by midnight. Your club says it has no time to find a replacement.',
  deadlineGoLabel: 'Head off for the medical right now',
  deadlineGoOk:
    'The paperwork went in three minutes before midnight. The club agreed to let you go when the season ends.',
  deadlineGoFail:
    'The paperwork arrived two minutes after midnight. The move collapsed, and the training ground was frosty the next day.',
  deadlineStayLabel: 'Turn the offer down and stay',
  deadlineStayOk:
    'You texted your agent to say no. The next day the manager came over to greet you before training.',

  bootTitle: 'Golden Boot race',
  bootText:
    'The final league match. You are one goal behind the top scorer. Late in the second half, a penalty is given. The designated taker is a teammate.',
  bootAskLabel: 'Ask the taker for the ball',
  bootAskOk:
    'Your teammate handed you the ball. You sent the keeper the wrong way into the left corner. Your name went to the top of the scoring chart.',
  bootAskFail:
    'Your teammate would not give up the ball, and the TV cameras caught the two of you arguing.',
  bootTeamLabel: 'Leave it to the taker',
  bootTeamOk: 'Your teammate scored calmly. You were the first to run over and hug him.',

  testiTitle: 'Testimonial match',
  testiText: (p) =>
    `This is your ${p.n}th season at ${tn(p.club)}. The club is holding a testimonial match in your name for your long service. Former teammates are calling one by one to say they will play.`,
  testiGiveLabel: 'Donate the gate receipts to local youth football',
  testiGiveOk:
    'After the match, the youth players walked onto the pitch holding a huge thank-you banner.',
  testiKeepLabel: (p) => `Keep the proceeds (${p.fee})`,
  testiKeepOk:
    'You received the proceeds. You had dinner with your former teammates until late at night.',

  cwcTitle: 'FIFA Club World Cup',
  cwcText:
    'Instead of a summer holiday, the FIFA Club World Cup is on in the United States. Thirty-two clubs spend a month deciding the world champion. When it ends, the new season starts straight away.',
  cwcAllLabel: 'Volunteer to play every match',
  cwcAllOk:
    'You played every match in 35-degree midday heat. At every stadium, fans waved your shirt.',
  cwcAllFail:
    'After a gruelling run in the heat, you went out in the group stage. You started the new season exhausted.',
  cwcRestLabel: 'Ask to be rotated and save your legs',
  cwcRestOk:
    'You watched two group matches from the bench. The manager changed the team sheet without a word.',

  flightTitle: 'A league match after a long flight',
  flightText:
    'You are back from two international matches after a twelve-hour flight. You are still jet-lagged, and there is a league match in two days.',
  flightPlayLabel: 'Volunteer to start',
  flightPlayOk:
    'You got through 90 minutes on tired legs. After the match, the manager called you aside to thank you.',
  flightPlayFail: 'Your thigh tightened twenty minutes into the second half. You limped off.',
  flightRestLabel: 'Ask the manager for a rest',
  flightRestOk: 'You watched from the bench. You went into the next match feeling fresh.',
};
