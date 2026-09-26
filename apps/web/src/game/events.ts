// ───────── 랜덤 이벤트 (기본 이벤트 정의) ─────────
import { ATTR_KEYS, POS } from './data.js';
import { ovr, wOf } from './attributes.js';
import { clamp, ri, pick, chance } from './rng.js';
import {
  leagueOf, roleOf, labelOf, addStat, addAttr, fmtMoney, adFee, trainerFee, bestKey, weakKey,
  isPro, byPos, isAtk, startStory, schedule, storyActive, pkWin,
} from './engine.js';
import type { EventDef } from './types.js';

export const BASE_EVENTS: EventDef[] = [
  {
    id: 'bench-talk', title: '감독실 노크', w: 3, cond: (s) => roleOf(s) !== '주전' && s.phase > 0,
    text: () => `출전 시간이 좀처럼 늘지 않습니다. 감독실 문 앞에 섰습니다.`,
    choices: [
      {
        label: '출전 기회를 강하게 요구한다', p: (s) => clamp(0.4 + (ovr(s) - s.club.str) * 0.05 + s.trust * 0.06 + (s.fame - 60) / 250, 0.08, 0.85),
        ok: { text: '감독이 고개를 끄덕였습니다. "다음 경기, 네가 선발이다."', fx: (s) => { if (isPro(s) && !s.story?.mentor) { startStory(s, 'mentor'); schedule(s, 'mentor-2', ri(2, 3)); } addStat(s, 'trust', 3); addStat(s, 'morale', 8); } },
        fail: { text: '"여기가 네 마음대로 하는 곳인 줄 아나?" 분위기가 싸늘해졌습니다.', fx: (s) => { addStat(s, 'trust', -2); addStat(s, 'morale', -8); } },
      },
      { label: '묵묵히 훈련장에 남는다', ok: { text: '야간 훈련이 쌓여갑니다. 코치진이 지켜보고 있습니다.', fx: (s) => { addStat(s, 'trust', 1); addAttr(s, pick(ATTR_KEYS), 1.5); addStat(s, 'cond', -10); } } },
    ],
  },
  {
    id: 'knock', title: '훈련 중 통증', w: 2, cond: (s) => s.injury === 0,
    text: () => '훈련 도중 햄스트링이 찌릿합니다. 의무팀은 휴식을 권합니다.',
    choices: [
      {
        label: '참고 다음 경기에 뛴다', p: (s) => (s.trait === 'iron' ? 0.8 : 0.5),
        ok: { text: '다행히 별 이상 없이 넘어갔습니다. 감독이 투지를 높이 샀습니다.', fx: (s) => addStat(s, 'trust', 1) },
        fail: { text: '경기 중 통증이 재발했습니다. 장기 이탈입니다.', fx: (s) => { s.injury = ri(6, 12); addStat(s, 'morale', -10); } },
      },
      { label: '충분히 쉰다', ok: { text: '2경기를 쉬며 몸을 완전히 회복했습니다.', fx: (s) => { s.injury = 2; addStat(s, 'cond', 25); } } },
    ],
  },
  {
    id: 'ad', title: '광고 모델 제의', w: 2, cond: (s) => s.fame >= 25,
    text: (s) => `스포츠 브랜드에서 광고 모델 제의가 들어왔습니다. 모델료는 ${fmtMoney(adFee(s))}.`,
    choices: [
      { label: '계약한다', ok: { text: (s) => (roleOf(s) === '주전' ? '촬영은 고됐지만 통장은 두둑해졌습니다. 구단 마케팅팀도 반색합니다.' : '통장은 두둑해졌지만, "경기보다 광고"라는 뒷말이 들려옵니다.'), fx: (s) => { addStat(s, 'money', adFee(s)); addStat(s, 'fame', 5); addStat(s, 'morale', 5); addStat(s, 'cond', -6); addStat(s, 'trust', roleOf(s) === '주전' ? 0.5 : -1); } } },
      { label: '축구에만 집중한다', ok: { text: '팬들은 당신의 진지함을 좋아합니다.', fx: (s) => { addStat(s, 'morale', 4); addStat(s, 'trust', 0.8); } } },
    ],
  },
  {
    id: 'interview', title: '경기 전 인터뷰', w: 2, cond: () => true,
    text: () => '기자가 마이크를 들이밉니다. "이번 상대, 자신 있습니까?"',
    choices: [
      {
        label: byPos<string>({ FW: '"제가 골 넣고 이깁니다."', MF: '"제가 경기를 지배하겠습니다."', DF: '"상대 공격수, 한 번도 못 뚫게 하겠습니다."', GK: '"오늘은 한 골도 안 줍니다."' }),
        p: (s) => clamp(0.35 + (ovr(s) - leagueOf(s.leagueId).avg) * 0.03, 0.15, 0.8),
        ok: { text: byPos<string>({ FW: '예고한 그대로 골을 넣었습니다. 하이라이트가 SNS를 도배합니다.', MF: '패스 성공률 94%. 예고대로 중원을 지배했습니다.', DF: '상대 에이스를 슈팅 0개로 묶었습니다. 예고가 현실이 됐습니다.', GK: '예고한 그대로 무실점. 선방 모음 영상이 SNS를 도배합니다.' }), fx: (s) => { addStat(s, 'fame', 8); addStat(s, 'morale', 6); } },
        fail: { text: byPos<string>({ FW: '침묵한 경기 후, 조롱 섞인 짤이 돌기 시작했습니다.', MF: '중원 싸움에서 밀렸습니다. 큰소리친 인터뷰가 다시 회자됩니다.', DF: '상대 공격수에게 멀티골을 내줬습니다. 인터뷰 캡처가 돌기 시작했습니다.', GK: '실점 장면마다 인터뷰 자막이 붙은 짤이 돌고 있습니다.' }), fx: (s) => { addStat(s, 'fame', 2); addStat(s, 'morale', -9); } },
      },
      { label: '"팀이 이기는 게 먼저입니다."', ok: { text: '무난한 답변. 감독은 만족한 눈치입니다.', fx: (s) => addStat(s, 'trust', 0.5) } },
    ],
  },
  {
    id: 'rival', title: '포지션 경쟁자 영입', w: 2, cond: (s) => isPro(s) && s.phase <= 1,
    text: (s) => `구단이 같은 ${POS[s.pos].label} 포지션에 거액을 들여 새 선수를 데려왔습니다.`,
    choices: [
      {
        label: '훈련 강도를 두 배로 올린다', p: (s) => clamp(0.2 + s.cond / 130 - Math.max(0, s.age - 26) * 0.03, 0.15, 0.85),
        ok: { text: '경쟁이 당신을 더 날카롭게 만들었습니다.', fx: (s) => { for (const k of ATTR_KEYS) if (wOf(s)[k] > 0.15) addAttr(s, k, 2); addStat(s, 'cond', -12); } },
        fail: { text: '무리한 훈련 끝에 근육이 올라왔습니다.', fx: (s) => { s.injury = ri(3, 6); addStat(s, 'cond', -10); } },
      },
      { label: '평소 루틴을 지킨다', ok: { text: (s) => (s.age >= 28 ? '베테랑답게 흔들리지 않았습니다. 감독은 경험을 믿어 보기로 합니다.' : '흔들리지 않았지만, 감독의 시선이 조금 옮겨간 것 같습니다.'), fx: (s) => { addStat(s, 'trust', s.age >= 28 ? 0.5 : -1); addStat(s, 'cond', 6); addStat(s, 'morale', 3); } } },
    ],
  },
  {
    id: 'scout', title: '관중석의 해외 스카우트', w: 2, cond: (s) => ovr(s) >= 60 && leagueOf(s.leagueId).tier <= 5,
    text: () => '오늘 경기에 유럽 빅클럽 스카우트가 왔다는 소문이 돕니다.',
    choices: [
      {
        label: byPos<string>({ FW: '개인 쇼케이스를 노린다', MF: '킬패스와 탈압박으로 눈도장을 찍는다', DF: '적극적인 태클과 전진 수비로 어필한다', GK: '과감한 선방과 빌드업으로 어필한다' }),
        p: (s) => clamp(0.3 + (ovr(s) - 62) * 0.03 + (s.cond - 60) / 200, 0.1, 0.85),
        ok: { text: '스카우트 수첩에 당신 이름이 크게 적혔습니다. 이적시장이 기대됩니다.', fx: (s) => { if (!s.story?.europe && leagueOf(s.leagueId).tier < 4) { startStory(s, 'europe'); schedule(s, 'europe-2', ri(1, 2)); } s.flags.scouted = true; addStat(s, 'fame', 5); } },
        fail: { text: byPos<string>({ FW: '욕심이 과했습니다. 무리한 슈팅만 난사하다 교체됐습니다.', MF: '욕심이 과했습니다. 무리한 드리블이 끊기며 역습을 허용했습니다.', DF: '공격 가담 욕심에 뒷공간을 내줬습니다.', GK: '무리한 전진 패스가 끊기며 실점의 빌미가 됐습니다.' }), fx: (s) => { addStat(s, 'trust', -1); addStat(s, 'morale', -6); } },
      },
      { label: '팀 플레이에 충실한다', ok: { text: '화려하진 않았지만 안정적인 경기였습니다.', fx: (s) => { addStat(s, 'trust', 1); if (chance(0.25)) s.flags.scouted = true; } } },
    ],
  },
  {
    id: 'party', title: '파티 초대', w: 2, cond: (s) => s.fame >= 15,
    text: () => '유명 연예인의 생일 파티 초대장이 왔습니다. 경기는 이틀 뒤.',
    choices: [
      {
        label: '잠깐만 들른다', p: () => 0.7,
        ok: { text: '인맥도 넓히고 기분 전환도 했습니다.', fx: (s) => { addStat(s, 'fame', 4); addStat(s, 'morale', 6); } },
        fail: { text: '새벽 사진이 찍혀 기사화됐습니다. 구단이 벌금을 부과했습니다.', fx: (s) => { if (!storyActive(s, 'scandal')) { startStory(s, 'scandal'); schedule(s, 'scandal-2', 1); } addStat(s, 'fame', -5); addStat(s, 'trust', -2.5); addStat(s, 'money', -Math.max(100, Math.round(s.money * 0.05))); } },
      },
      { label: '집에서 푹 잔다', ok: { text: '컨디션은 최상입니다.', fx: (s) => addStat(s, 'cond', 10) } },
    ],
  },
  {
    id: 'mentor', title: '레전드 선배의 조언', w: 2, cond: () => true,
    text: (s) => `은퇴한 대선배가 훈련장에 찾아왔습니다. "${labelOf(s, bestKey(s))}은 좋은데, 나머지가 아쉽구나."`,
    choices: [
      {
        label: '비법을 전수받는다', p: () => 0.65,
        ok: { text: '작은 습관 하나가 플레이를 바꿨습니다.', fx: (s) => { addAttr(s, weakKey(s), 3); addStat(s, 'morale', 3); } },
        fail: { text: '따라 하기엔 아직 몸이 준비되지 않았습니다.', fx: (s) => addAttr(s, weakKey(s), 0.5) },
      },
      { label: '장점을 더 갈고닦겠다고 말한다', ok: { text: '"그것도 방법이지." 선배가 웃었습니다.', fx: (s) => addAttr(s, bestKey(s), 2) } },
    ],
  },
  {
    id: 'newcoach', title: '감독 경질', w: 1, cond: (s) => isPro(s) && s.phase >= 1,
    text: () => '성적 부진으로 감독이 경질됐습니다. 새 감독은 전혀 다른 전술을 씁니다.',
    choices: [
      {
        label: '새 전술에 먼저 적응한다', p: (s) => clamp(0.3 + s.morale / 300 - (s.age - 25) * 0.03, 0.15, 0.8),
        ok: { text: '새 감독이 가장 먼저 이름을 부른 선수가 됐습니다.', fx: (s) => { s.trust = Math.min(6, Math.max(s.trust * 0.7, 0) + 2.5); } },
        fail: { text: '전술 이해도가 부족하다는 평가를 받았습니다.', fx: (s) => { s.trust = Math.min(s.trust * 0.7, 0) - 1.5; } },
      },
      { label: '서두르지 않고 지켜본다', ok: { text: '새 감독은 전임 감독의 평가표를 참고하겠다고 합니다. 쌓아 온 신뢰가 상당 부분 이어집니다.', fx: (s) => { s.trust = Math.round(s.trust * 7) / 10; addStat(s, 'morale', 2); } } },
    ],
  },
  {
    id: 'haters', title: '악플 세례', w: 1, cond: (s) => s.fame >= 20 && s.morale < 70,
    text: () => '최근 부진한 경기 후 SNS에 악성 댓글이 쏟아집니다.',
    choices: [
      {
        label: '정면으로 반박한다', p: (s) => clamp(0.15 + (s.age - 20) * 0.03 + s.trust * 0.04, 0.1, 0.75),
        ok: { text: '당당한 대응에 팬들이 응원으로 화답했습니다.', fx: (s) => { addStat(s, 'fame', 5); addStat(s, 'morale', 6); } },
        fail: { text: '논란이 더 커졌습니다.', fx: (s) => { addStat(s, 'fame', -4); addStat(s, 'morale', -10); } },
      },
      { label: '앱을 지우고 운동에 집중한다', ok: { text: '마음은 편해졌습니다.', fx: (s) => addStat(s, 'morale', 3) } },
    ],
  },
  {
    id: 'trainer', title: '퍼스널 트레이너', w: 1, cond: (s) => s.money >= trainerFee(s) && s.age <= 28,
    text: (s) => `유명 퍼포먼스 트레이너가 1년 전담 계약을 제안합니다. 비용 ${fmtMoney(trainerFee(s))}.`,
    choices: [
      {
        label: '투자한다', p: (s) => clamp(0.3 + s.cond / 140, 0.4, 0.85),
        ok: { text: (s) => (s.age <= 23 ? '몸의 한계치가 올라간 느낌입니다.' : '잔부상이 줄고, 몸의 한계치도 조금 올라간 느낌입니다.'), fx: (s) => { addStat(s, 'money', -trainerFee(s)); s.flags.potBonus = (s.flags.potBonus ?? 0) + (s.age <= 23 ? 2 : 1); addAttr(s, 'phy', 1.5); addAttr(s, 'pac', 1); } },
        fail: { text: '지친 몸에 프로그램이 과했습니다. 비용은 비용대로 나가고 근육까지 올라왔습니다.', fx: (s) => { addStat(s, 'money', -trainerFee(s)); s.injury = Math.max(s.injury, ri(2, 4)); } },
      },
      { label: '구단 스포츠과학팀 프로그램을 따른다', ok: { text: '돈을 아꼈습니다. 구단 스포츠과학팀과 맞춤 프로그램을 짰고, 효과는 천천히 찾아옵니다.', fx: (s) => { s.flags.potBonus = (s.flags.potBonus ?? 0) + 1; addStat(s, 'trust', 0.5); addStat(s, 'cond', 5); } } },
    ],
  },
  {
    id: 'charity', title: '유소년 축구 교실', w: 1, cond: () => true,
    text: () => '고향 초등학교에서 축구 교실 재능기부 요청이 왔습니다.',
    choices: [
      { label: '흔쾌히 간다', ok: { text: '아이들의 눈빛에서 초심을 되찾았습니다.', fx: (s) => { addStat(s, 'morale', 8); addStat(s, 'fame', 3); addStat(s, 'cond', -4); } } },
      { label: '시즌 중이라 거절한다', ok: { text: '아쉽지만 휴식을 택했습니다. 감독은 프로다운 판단이라고 했습니다.', fx: (s) => { addStat(s, 'cond', 8); addStat(s, 'trust', 0.6); } } },
    ],
  },
  {
    id: 'slump', title: '슬럼프', w: 2, cond: (s) => s.morale < 50,
    text: byPos<string>({ FW: '골대가 유난히 작아 보입니다. 몇 경기째 골이 없고, 잠도 잘 오지 않습니다.', MF: '패스가 자꾸 발끝에서 어긋납니다. 잠도 잘 오지 않습니다.', DF: '뒷공간을 연달아 내줬습니다. 눈을 감아도 실점 장면이 떠오릅니다.', GK: '평범한 슈팅이 손끝을 빠져나갑니다. 눈을 감아도 실점 장면이 떠오릅니다.' }),
    choices: [
      {
        label: '멘탈 코치와 상담한다', p: () => 0.8,
        ok: { text: '마음이 한결 가벼워졌습니다.', fx: (s) => { addStat(s, 'morale', 18); addStat(s, 'money', -150); } },
        fail: { text: '아직은 시간이 더 필요해 보입니다.', fx: (s) => { addStat(s, 'morale', 5); addStat(s, 'money', -150); } },
      },
      {
        label: '혼자 이겨낸다', p: (s) => clamp(0.15 + (s.age - 20) * 0.045, 0.15, 0.8),
        ok: { text: '스스로 벽을 넘었습니다. 한층 단단해졌습니다. 감독도 달라진 눈빛을 알아챘습니다.', fx: (s) => { addStat(s, 'morale', 20); addStat(s, 'trust', 1); } },
        fail: { text: '슬럼프가 길어지고 있습니다.', fx: (s) => { addStat(s, 'morale', -6); addStat(s, 'trust', -1); } },
      },
    ],
  },
  {
    id: 'penalty', title: '결정적인 페널티킥', w: 2, cond: (s) => isAtk(s) && s.phase > 0 && s.injury === 0,
    text: () => '후반 추가시간, 1-1. 페널티킥이 선언됐고 주장이 당신을 바라봅니다.',
    choices: [
      {
        label: '내가 찬다', p: (s) => clamp(0.55 + (s.attrs.sho - 60) * 0.012 + (s.morale - 60) / 300, 0.35, 0.92),
        ok: { text: '골망이 흔들립니다! 극장 결승골!', fx: (s) => { s.season.goals++; pkWin(s); addStat(s, 'fame', 6); addStat(s, 'morale', 8); } },
        fail: { text: '크로스바를 때렸습니다… 경기장이 조용해졌습니다. 전담 키커를 제친 결정이라 뒷말이 나옵니다.', fx: (s) => { addStat(s, 'morale', -10); addStat(s, 'fame', -2); addStat(s, 'trust', -0.8); } },
      },
      { label: '전담 키커에게 양보한다', ok: { text: '동료가 성공시켰습니다. 감독은 팀 규칙을 지킨 당신을 기억합니다.', fx: (s) => { pkWin(s); addStat(s, 'morale', 3); addStat(s, 'trust', 1.2); } } },
    ],
  },
  {
    id: 'pk-save', title: '승부차기', w: 2, cond: (s) => s.pos === 'GK' && s.phase > 0,
    text: () => '컵 대회 승부차기. 마지막 키커가 공을 내려놓습니다.',
    choices: [
      {
        label: '왼쪽으로 몸을 던진다', p: (s) => clamp(0.3 + (s.attrs.pac - 70) * 0.015, 0.12, 0.7),
        ok: { text: '막았습니다! 영웅이 됐습니다.', fx: (s) => { addStat(s, 'fame', 7); addStat(s, 'morale', 10); addStat(s, 'trust', 1.5); } },
        fail: { text: '반대 방향이었습니다.', fx: (s) => addStat(s, 'morale', -6) },
      },
      {
        label: '끝까지 기다린다', p: (s) => clamp(0.3 + (s.attrs.def - 78) * 0.012 + (s.age - 26) * 0.01, 0.12, 0.7),
        ok: { text: '침착함이 빛났습니다. 정면 슈팅을 잡아냈습니다!', fx: (s) => { addStat(s, 'fame', 7); addStat(s, 'morale', 10); addStat(s, 'trust', 1.5); } },
        fail: { text: '구석으로 꽂혔습니다.', fx: (s) => addStat(s, 'morale', -6) },
      },
    ],
  },
  {
    id: 'family', title: '집에서 걸려온 전화', w: 1, cond: () => true,
    text: () => '어머니가 편찮으시다는 연락입니다. 원정 경기를 앞두고 있습니다.',
    choices: [
      { label: '휴가를 내고 집에 간다', ok: { text: '가족 곁을 지켰습니다. 다행히 금방 회복하셨습니다. 감독도 흔쾌히 보내 주었습니다.', fx: (s) => { s.injury = Math.max(s.injury, 1); addStat(s, 'morale', 12); addStat(s, 'trust', 0.5); } } },
      {
        label: '경기에 집중한다', p: (s) => clamp(0.25 + (s.morale - 55) / 90, 0.15, 0.85),
        ok: { text: '승리 소식을 들은 어머니가 누구보다 기뻐하셨습니다.', fx: (s) => { addStat(s, 'morale', 4); addStat(s, 'trust', 1); } },
        fail: { text: '마음이 콩밭에 가 있었습니다. 실수 끝에 교체됐습니다.', fx: (s) => { addStat(s, 'morale', -10); addStat(s, 'trust', -0.5); } },
      },
    ],
  },
  {
    id: 'rumor', title: '이적설', w: 2, cond: (s) => isPro(s) && s.fame >= 30,
    text: () => '빅클럽 이적설 기사가 쏟아집니다. 구단 팬들이 술렁입니다.',
    choices: [
      { label: '"더 큰 무대가 꿈입니다."', ok: { text: '관심 구단들이 움직이기 시작했습니다. 대신 홈 팬들은 서운해합니다.', fx: (s) => { s.flags.scouted = true; addStat(s, 'trust', s.contract && s.contract.years <= 1 ? -0.5 : -2); addStat(s, 'fame', 3); addStat(s, 'morale', 4); } } },
      { label: '"이 팀에서 우승하고 싶습니다."', ok: { text: (s) => (s.contract && s.contract.years <= 1 ? '홈 팬들은 환호했지만, 재계약 소식이 없다는 걸 모두가 압니다.' : '홈 팬들이 당신의 이름을 연호합니다.'), fx: (s) => { addStat(s, 'trust', s.contract && s.contract.years <= 1 ? 0.5 : 2); addStat(s, 'morale', 5); } } },
    ],
  },
  {
    id: 'diet', title: '체지방 측정', w: 1, cond: () => true,
    text: () => '구단 피지컬 코치가 체지방 수치를 보고 한숨을 쉽니다.',
    choices: [
      {
        label: '엄격한 식단에 돌입한다', p: (s) => clamp(0.2 + (s.morale - 50) / 70, 0.15, 0.85),
        ok: { text: '몸이 가벼워졌습니다.', fx: (s) => { addAttr(s, 'pac', 2); addAttr(s, 'phy', 1); } },
        fail: { text: '야식의 유혹을 이기지 못했습니다. 짜증만 늘었습니다.', fx: (s) => { addStat(s, 'morale', -5); addStat(s, 'cond', -5); } },
      },
      { label: '먹는 게 남는 거다', ok: { text: '잘 먹고 잘 잤습니다. 몸은 조금 무거워졌지만 기운은 넘칩니다.', fx: (s) => { addStat(s, 'morale', 6); addStat(s, 'cond', 10); addAttr(s, 'phy', 1); } } },
    ],
  },
  {
    id: 'final', title: '전국대회 결승전', w: 3, cond: (s) => !!leagueOf(s.leagueId).amateur && s.phase === 2 && !s.flags['final' + s.year],
    text: () => '전국대회 결승. 프로 스카우트들이 본부석을 가득 채웠습니다.',
    choices: [
      {
        label: '에이스답게 해결한다', p: (s) => clamp(0.35 + (ovr(s) - s.club.str) * 0.04, 0.15, 0.8),
        ok: { text: '결승전을 지배했습니다. 스카우트들의 전화가 울리기 시작합니다.', fx: (s) => { s.flags['final' + s.year] = 1; addStat(s, 'fame', 12); s.flags.scouted = (s.flags.scouted as boolean) || ovr(s) >= 58; addStat(s, 'morale', 10); } },
        fail: { text: '준우승. 눈물이 났지만, 아직 끝이 아닙니다.', fx: (s) => { s.flags['final' + s.year] = 1; addStat(s, 'fame', 4); } },
      },
      { label: '동료를 살리는 플레이', ok: { text: '팀이 하나로 뭉쳤습니다. 감독은 "진짜 에이스는 동료를 빛나게 한다"며 당신을 추천서 맨 위에 올렸습니다.', fx: (s) => { s.flags['final' + s.year] = 1; addStat(s, 'fame', 6); addStat(s, 'morale', 6); addStat(s, 'trust', 2); } } },
    ],
  },
];
