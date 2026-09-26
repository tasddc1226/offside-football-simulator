// ───────── 실제 축구계에서 일어나는 사건들 ─────────
import { clamp, ri, pick } from './rng.js';
import { leagueOf, addStat, addAttr, isPro, byPos, adFee } from './engine.js';
import { ovr } from './attributes.js';
import { callupScore, RELEASE } from './national.js';
import type { EventDef, GameState } from './types.js';

const DERBY: Record<string, string> = { k2: '경인 더비', k1: '동해안 더비', j1: '다마가와 클라시코', mls: '엘 트라피코', ere: '데 클라시커르', l1: '르 클라시크', bl: '데어 클라시커', sa: '밀라노 더비', ll: '엘 클라시코', pl: '맨체스터 더비' };
const CAMP = (s: GameState) => (s.leagueId === 'mls' ? pick(['미국 플로리다', '미국 애리조나', '멕시코 칸쿤']) : leagueOf(s.leagueId).tier <= 3 ? pick(['튀르키예 안탈리아', '태국 치앙마이', '일본 가고시마', '제주 서귀포']) : pick(['스페인 마르베야', 'UAE 두바이', '미국 플로리다']));

// 아시안게임·올림픽 남자축구는 FIFA 의무 차출 대회가 아니다 — 해외 구단 소속이면 차출을 협상해야 한다.
// 결과는 national.ts RELEASE[key].flag + 연도 플래그로 남아 대표팀 명단 선발에 쓰인다.
function releaseEvent(o: { id: string; title: string; key: 'ag' | 'olympic'; year: number; text: string; blessing: string; refusal: string; missed: string }): EventDef {
  const flag = RELEASE[o.key]!.flag;
  const set = (s: GameState, v: boolean) => (s.flags[flag + s.year] = v);
  return {
    id: o.id, title: o.title, w: 6,
    cond: (s) => isPro(s) && s.year % 4 === o.year && s.nat?.qual[s.year] !== false && s.phase <= 1 && s.age <= 23 && leagueOf(s.leagueId).tier >= 3 && s.flags[flag + s.year] === undefined && !(s.mil && (s.mil.exempt || s.mil.served)) && callupScore(s) >= 62,
    text: () => o.text,
    choices: [
      {
        label: '구단 수뇌부와 직접 담판을 짓는다', p: (s) => clamp(0.4 + s.trust * 0.06 + (s.fame - 25) * 0.006, 0.15, 0.85),
        ok: { text: o.blessing, fx: (s) => { set(s, true); addStat(s, 'morale', 8); addStat(s, 'fame', 5); } },
        fail: { text: o.refusal, fx: (s) => { set(s, false); addStat(s, 'morale', -8); } },
      },
      {
        label: '재계약 조건으로 차출을 약속받는다', p: (s) => clamp(0.95 - (s.contract ? s.contract.years : 0) * 0.15, 0.25, 0.85),
        ok: { text: '연봉 인상 없이 계약을 1년 연장하는 조건으로 차출을 허락받았습니다.', fx: (s) => { set(s, true); if (s.contract) s.contract.years++; addStat(s, 'trust', 1); } },
        fail: { text: o.missed, fx: (s) => { set(s, false); addStat(s, 'morale', -5); } },
      },
      { label: '팀에 남아 시즌에 집중한다', ok: { text: '감독이 당신의 결정에 고마워합니다.', fx: (s) => { set(s, false); addStat(s, 'trust', 1.2); } } },
    ],
  };
}

export const REAL_EVENTS: EventDef[] = [
  {
    id: 'var', title: 'VAR 온필드 리뷰', w: 2, cond: (s) => isPro(s) && s.phase > 0,
    text: byPos<string>({
      FW: '결승골처럼 보였던 당신의 슈팅. 주심이 귀에 손을 대더니 모니터로 달려갑니다. 오프사이드 라인이 그려지고 있습니다.',
      MF: '당신의 중거리 슛이 골망을 갈랐습니다. 그런데 주심이 모니터로 향합니다. 빌드업 과정의 핸드볼 여부를 확인합니다.',
      DF: '페널티 박스 안에서 당신의 태클에 상대가 쓰러졌습니다. 주심이 온필드 리뷰를 위해 모니터로 달려갑니다.',
      GK: '1대1 상황, 몸을 던져 공을 쳐냈지만 상대가 넘어졌습니다. 주심이 페널티킥 여부를 모니터로 확인합니다.',
    }),
    choices: [
      {
        label: '주심에게 강하게 항의한다', p: (s) => clamp(0.05 + s.fame / 200 + (s.age - 22) * 0.02, 0.05, 0.7),
        ok: { text: byPos<string>({ FW: '판정은 그대로 골! 기싸움에서도 이겼습니다. 동료들이 당신 뒤에 똘똘 뭉칩니다.', MF: '판정은 그대로 골! 기싸움에서도 이겼습니다. 동료들이 당신 뒤에 똘똘 뭉칩니다.', def: '노 페널티! 공을 먼저 건드렸다는 판정입니다. 기싸움에서도 밀리지 않았습니다.' }), fx: (s) => { addStat(s, 'morale', 6); addStat(s, 'fame', 2); addStat(s, 'trust', 1.5); } },
        fail: { text: byPos<string>({ FW: '골 취소에 옐로카드까지. 감독이 벤치에서 고개를 젓습니다.', MF: '골 취소에 옐로카드까지. 감독이 벤치에서 고개를 젓습니다.', def: '페널티킥 선언에 항의성 옐로카드까지. 감독이 벤치에서 고개를 젓습니다.' }), fx: (s) => { addStat(s, 'trust', -1.5); addStat(s, 'morale', -5); } },
      },
      {
        label: '두 손을 모으고 기다린다', p: () => 0.5,
        ok: { text: byPos<string>({ FW: '"GOAL!" 전광판에 VAR 확인 완료. 두 번 환호한 골이 됐습니다.', MF: '"GOAL!" 전광판에 VAR 확인 완료. 두 번 환호한 골이 됐습니다.', def: '"NO PENALTY" 전광판에 판정이 뜨자 홈 관중이 환호합니다. 깔끔한 수비였습니다.' }), fx: (s) => { addStat(s, 'morale', 8); addStat(s, 'fame', 3); } },
        fail: { text: byPos<string>({ FW: '어깨 하나 차이 오프사이드. 담담히 다음 플레이를 준비합니다.', MF: '핸드볼 확인, 골 취소. 담담히 다음 플레이를 준비합니다.', DF: '페널티킥 선언. 고개를 숙였지만 다음 플레이를 준비합니다.', GK: '페널티킥 선언. 이제 키커와 마주 서야 합니다.' }), fx: (s) => { addStat(s, 'morale', -2); addStat(s, 'trust', 0.5); } },
      },
    ],
  },
  {
    id: 'racism', title: '원정 관중석의 인종차별', w: 1, cond: (s) => leagueOf(s.leagueId).tier >= 4 && s.phase > 0,
    text: () => '원정 경기 도중 관중석에서 동양인을 비하하는 몸짓과 구호가 들려옵니다. 동료들이 당신 곁으로 모여듭니다.',
    choices: [
      { label: '주심에게 알리고 인종차별 대응 절차를 요청한다', ok: { text: '경기가 잠시 중단되고 장내 경고 방송이 나갔습니다. 구단과 리그가 공식 성명을 내며 당신을 지지했습니다.', fx: (s) => { addStat(s, 'fame', 5); addStat(s, 'trust', 1); addStat(s, 'morale', -3); } } },
      {
        label: '경기력으로 답한다', p: (s) => clamp(0.35 + (ovr(s) - leagueOf(s.leagueId).avg) * 0.03, 0.15, 0.75),
        ok: { text: byPos<string>({ FW: '골을 넣고 조용히 가슴의 엠블럼을 가리켰습니다. 전 세계 축구 팬들이 당신 편에 섰습니다.', MF: '결승골을 도운 뒤 조용히 가슴의 엠블럼을 가리켰습니다. 전 세계 축구 팬들이 당신 편에 섰습니다.', DF: '완벽한 무실점 수비로 경기를 끝낸 뒤 조용히 엠블럼을 가리켰습니다. 전 세계 축구 팬들이 당신 편에 섰습니다.', GK: '결정적 선방을 연달아 해낸 뒤 조용히 엠블럼을 가리켰습니다. 전 세계 축구 팬들이 당신 편에 섰습니다.' }), fx: (s) => { addStat(s, 'fame', 9); addStat(s, 'morale', 6); } },
        fail: { text: '마음이 흔들린 채로 90분이 지나갔습니다. 동료들이 끝까지 곁을 지켜주었습니다.', fx: (s) => addStat(s, 'morale', -8) },
      },
    ],
  },
  {
    id: 'winter-window', title: '겨울 이적시장', w: 3, cond: (s) => isPro(s) && s.phase === 1 && ovr(s) >= 62 && !(s.mil && s.mil.serving),
    text: (s) => `1월 이적시장이 열렸습니다. 한 단계 위 리그의 구단이 ${s.club.name}에 공식 문의를 보냈다는 보도가 나옵니다. 구단은 "시즌 중 이적 불가" 방침입니다.`,
    choices: [
      {
        label: '구단에 이적을 요청한다', p: (s) => clamp(0.35 + s.trust * 0.05 + (s.fame - 30) * 0.005, 0.15, 0.7),
        ok: { text: '구단이 여름 이적을 약속했습니다. 이번 시즌이 끝나면 더 큰 무대가 기다립니다.', fx: (s) => { s.flags.scouted = true; addStat(s, 'morale', 6); } },
        fail: { text: '구단은 요청을 거절했고, 이적 요청 사실이 언론에 새어 나갔습니다. 홈 팬들의 야유가 시작됐습니다.', fx: (s) => { addStat(s, 'trust', -2); addStat(s, 'morale', -8); addStat(s, 'fame', 2); } },
      },
      { label: '"우승을 위해 남겠습니다" 잔류를 선언한다', ok: { text: '팬들이 당신의 이름을 연호합니다. 감독의 신뢰도 한층 두터워졌습니다.', fx: (s) => { addStat(s, 'trust', 2); addStat(s, 'morale', 5); addStat(s, 'fame', 2); } } },
    ],
  },
  releaseEvent({
    id: 'ag-release', title: '아시안게임 차출 협상', key: 'ag', year: 2,
    text: '아시안게임 대표팀이 당신을 원합니다. 금메달이면 병역 특례. 하지만 아시안게임은 FIFA 의무 차출 대회가 아니어서, 시즌 중 차출은 소속팀 허락이 필요합니다.',
    blessing: '"금메달 따서 돌아와라." 구단이 차출을 허락했습니다.',
    refusal: '구단은 시즌 중 주전 이탈을 받아들일 수 없다며 거절했습니다.',
    missed: '협상은 결렬됐습니다. 이번 아시안게임은 TV로 지켜봐야 합니다.',
  }),
  releaseEvent({
    id: 'oly-release', title: '올림픽 차출 협상', key: 'olympic', year: 0,
    text: '올림픽 대표팀이 당신을 원합니다. 동메달 이상이면 병역 특례. 하지만 올림픽 남자축구도 FIFA 의무 차출 대회가 아니어서, 프리시즌과 겹치는 차출은 소속팀 허락이 필요합니다.',
    blessing: '"메달 걸고 돌아와라." 구단이 차출을 허락했습니다.',
    refusal: '구단은 새 시즌 준비에서 빠질 수 없다며 거절했습니다.',
    missed: '협상은 결렬됐습니다. 이번 올림픽은 TV로 지켜봐야 합니다.',
  }),
  {
    id: 'puskas', title: '원더골, 푸스카스상 후보', w: 1, cond: (s) => isPro(s) && s.phase > 0 && s.pos !== 'GK' && s.season.goals > 0 && !s.flags['puskas' + s.year],
    text: () => '35m 밖에서 때린 발리슛이 골망 구석에 꽂혔습니다. FIFA가 이 골을 푸스카스상 최종 후보로 선정했습니다. 수상자는 팬 투표와 전문가 투표로 결정됩니다.',
    choices: [
      {
        label: 'SNS로 팬 투표를 독려한다', p: (s) => clamp(0.02 + s.fame * 0.002 + leagueOf(s.leagueId).tier * 0.03, 0.03, 0.45),
        ok: { text: 'FIFA 푸스카스상 수상! 당신의 골이 올해 가장 아름다운 골로 선정됐습니다.', fx: (s) => { s.flags['puskas' + s.year] = 1; s.awards.push({ year: s.year, t: 'FIFA 푸스카스상' }); addStat(s, 'fame', 12); } },
        fail: { text: '수상은 불발됐고, 지나친 투표 독려가 입길에 올랐습니다. 그래도 전 세계가 그 골을 봤습니다.', fx: (s) => { s.flags['puskas' + s.year] = 1; addStat(s, 'fame', 2); addStat(s, 'morale', -4); } },
      },
      { label: '"동료들 덕분입니다"', ok: { text: '겸손한 소감이 화제가 됐습니다. 라커룸 분위기도 한층 좋아졌습니다.', fx: (s) => { s.flags['puskas' + s.year] = 1; addStat(s, 'fame', 4); addStat(s, 'trust', 1.5); addStat(s, 'morale', 4); } } },
    ],
  },
  {
    id: 'winter-camp', title: '전지훈련 캠프', w: 3, cond: (s) => isPro(s) && s.phase === 0,
    text: (s) => `${CAMP(s)}에서 3주간의 전지훈련이 시작됩니다. 코칭스태프가 시즌 구상을 끝내는 시기입니다.`,
    choices: [
      {
        label: '체력 훈련에서 1등을 노린다', p: (s) => clamp(0.45 + (s.attrs.phy - 60) * 0.02, 0.2, 0.85),
        ok: { text: '셔틀런 1위. 코치진 평가표에 "최상"이 찍혔습니다.', fx: (s) => { addAttr(s, 'phy', 2); addAttr(s, 'pac', 1); addStat(s, 'trust', 1.5); addStat(s, 'cond', -8); } },
        fail: { text: '무리하다 종아리가 올라왔습니다. 캠프 막판을 재활로 보냈습니다.', fx: (s) => { s.injury = ri(1, 3); addStat(s, 'cond', -10); } },
      },
      { label: '전술 미팅에 집중한다', ok: { text: '새 전술을 누구보다 빨리 이해했습니다.', fx: (s) => { addAttr(s, 'pas', 1); addStat(s, 'trust', 1); } } },
    ],
  },
  {
    id: 'team-k', title: '팀 K리그 선발', w: 3, cond: (s) => (s.leagueId === 'k1' || s.leagueId === 'k2') && s.phase === 1 && s.fame >= 28 && !s.flags['teamk' + s.year],
    text: () => '팬 투표로 팀 K리그에 선발됐습니다! 한여름, 방한한 유럽 빅클럽과 서울월드컵경기장에서 친선전을 치릅니다.',
    choices: [
      {
        label: '유럽 스카우트 앞에서 전력을 다한다', p: (s) => clamp(0.3 + (ovr(s) - 64) * 0.03, 0.12, 0.8),
        ok: { text: byPos<string>({ FW: '빅클럽 수비진을 흔든 원더골. 경기 뒤 상대 감독이 당신 이름을 물었습니다.', MF: '월드클래스 미드필더들 사이에서 탈압박 쇼. 경기 뒤 상대 감독이 당신 이름을 물었습니다.', DF: '세계적인 공격수를 꽁꽁 묶었습니다. 경기 뒤 상대 감독이 당신 이름을 물었습니다.', GK: '빅클럽 공격진의 슈팅을 연달아 막아냈습니다. 경기 뒤 상대 감독이 당신 이름을 물었습니다.' }), fx: (s) => { s.flags['teamk' + s.year] = 1; s.flags.scouted = true; addStat(s, 'fame', 8); addStat(s, 'cond', -6); } },
        fail: { text: '세계 수준의 벽을 실감했습니다. 무리한 탓에 몸도 무겁습니다.', fx: (s) => { s.flags['teamk' + s.year] = 1; addStat(s, 'fame', 2); addStat(s, 'morale', -5); addStat(s, 'cond', -10); } },
      },
      { label: '축제를 즐긴다', ok: { text: '팬들과 함께한 한여름 밤의 축제. 부상 없이 소속팀에 돌아와 감독도 안도했습니다.', fx: (s) => { s.flags['teamk' + s.year] = 1; addStat(s, 'fame', 4); addStat(s, 'morale', 8); addStat(s, 'trust', 1); addStat(s, 'cond', 4); } } },
    ],
  },
  {
    id: 'derby', title: '라이벌 더비', w: 2, cond: (s) => isPro(s) && s.phase > 0 && !!DERBY[s.leagueId] && !(s.mil && s.mil.serving),
    text: (s) => `${DERBY[s.leagueId]}. 한 주 내내 도시가 들썩였습니다. 경기장 공기가 평소와 다릅니다.`,
    choices: [
      {
        label: byPos<string>({ FW: '골을 넣고 원정석 앞에서 세리머니한다', MF: '경기를 지배하고 원정석 앞에서 세리머니한다', DF: '라이벌 에이스를 지우고 원정석을 도발한다', GK: '무실점으로 막고 원정석 앞에서 포효한다' }),
        p: (s) => clamp(0.3 + (ovr(s) - leagueOf(s.leagueId).avg) * 0.03, 0.12, 0.75),
        ok: { text: byPos<string>({ FW: '더비 결승골! 원정석이 얼어붙었고 홈 팬들은 당신을 영웅으로 추대했습니다.', MF: '더비 결승골 어시스트! 홈 팬들은 당신을 영웅으로 추대했습니다.', DF: '라이벌 에이스를 슈팅 0개로 묶은 완승. 홈 팬들이 당신의 이름을 연호합니다.', GK: '페널티킥 선방까지 곁들인 더비 클린시트! 홈 팬들이 당신의 이름을 연호합니다.' }), fx: (s) => { addStat(s, 'fame', 8); addStat(s, 'morale', 8); if (s.pos === 'FW') s.season.goals++; else if (s.pos === 'MF') s.season.assists++; else s.season.cs++; } },
        fail: { text: '패배. 라이벌 팬들이 당신의 사전 도발을 조롱합니다.', fx: (s) => { addStat(s, 'morale', -8); addStat(s, 'fame', 1); } },
      },
      { label: '경기 운영에 집중한다', ok: { text: '냉정하게 90분을 치렀습니다. 감독이 만족스러워합니다.', fx: (s) => addStat(s, 'trust', 1) } },
    ],
  },
  {
    id: 'asia-tour', title: '프리시즌 아시아 투어', w: 3, cond: (s) => leagueOf(s.leagueId).tier >= 5 && s.phase === 0,
    text: (s) => `${s.club.name}의 프리시즌 아시아 투어가 서울에서 열립니다. 6만 관중 대부분이 당신의 유니폼을 입고 있습니다.`,
    choices: [
      { label: '팬 사인회·행사를 모두 소화한다', ok: { text: '공항부터 경기장까지 환호가 이어졌습니다. 구단 유니폼 판매 1위를 찍었고, 구단 수뇌부도 흡족해합니다.', fx: (s) => { addStat(s, 'fame', 7); addStat(s, 'morale', 5); addStat(s, 'trust', 0.8); addStat(s, 'cond', s.age >= 30 ? -18 : -8); if (s.age >= 31) s.injury = Math.max(s.injury, 1); addStat(s, 'money', adFee(s) / 2); } } },
      { label: '컨디션 관리에 집중한다', ok: { text: '짧게 인사만 하고 훈련에 집중했습니다.', fx: (s) => { addStat(s, 'cond', 6); addStat(s, 'fame', 2); addStat(s, 'morale', 2); } } },
    ],
  },
];
