// ───────── 연쇄 이벤트 · 스토리 라인 ─────────
import { SURNAMES, GIVEN, POS } from './data.js';
import { ovr } from './attributes.js';
import { clamp, ri, pick } from './rng.js';
import {
  addStat, addAttr, startStory, advanceStory, endStory, schedule, storyActive, STORIES,
  byPos, bestKey, weakKey, agentFee, leagueOf, fmtMoney, labelOf, isPro,
} from './engine.js';
import type { EventDef, GameState } from './types.js';

export { STORIES };

function rivalName(s: GameState): string {
  if (!s.flags.rivalName) {
    let n: string;
    do n = pick(SURNAMES) + pick(GIVEN); while (n === s.name);
    s.flags.rivalName = n;
  }
  return s.flags.rivalName as string;
}
const rv = (s: GameState) => s.story.rival as unknown as { gap: number; tone: string };

export const STORY_EVENTS: EventDef[] = [
  // ── 평생의 라이벌 ──
  {
    id: 'rival-1', story: 'rival', stage: 1, title: '또래 라이벌의 등장', w: 2,
    cond: (s) => !s.story?.rival && s.age <= 24 && s.phase > 0,
    text: (s) => `같은 나이, 같은 ${POS[s.pos].label}. 언론이 당신과 ${rivalName(s)}을(를) 나란히 비교하기 시작했습니다.`,
    choices: [
      { label: '공개적으로 선전포고한다', ok: { text: '헤드라인: "누가 더 낫냐고요? 곧 알게 될 겁니다." 불이 붙었습니다.', fx: (s) => { startStory(s, 'rival', { gap: ri(0, 4), tone: 'loud' }); addStat(s, 'fame', ovr(s) >= s.club.str + 2 ? 8 : 3); addStat(s, 'morale', 4); schedule(s, 'rival-2', ri(2, 4)); } } },
      { label: '조용히 실력으로 보여준다', ok: { text: '말을 아꼈습니다. 대신 훈련장 불이 가장 늦게 꺼집니다.', fx: (s) => { startStory(s, 'rival', { gap: ri(0, 4), tone: 'quiet' }); addStat(s, 'trust', 1); schedule(s, 'rival-2', ri(2, 4)); } } },
    ],
  },
  {
    id: 'rival-2', story: 'rival', stage: 2, chain: true, title: '운명의 맞대결', w: 0, cond: () => true,
    text: (s) => `${rivalName(s)}과(와) 정면으로 맞붙는 날. ${rv(s).tone === 'loud' ? '선전포고 이후 첫 대결이라 경기장이 매진됐습니다.' : '두 사람의 첫 공식 맞대결입니다.'}`,
    choices: [
      {
        label: byPos<string>({ FW: '1대1 정면 승부를 건다', MF: '중원에서 정면 승부를 건다', DF: '라이벌과의 1대1 대인 마크를 자청한다', GK: '선방 대결에서 이기겠다고 다짐한다' }),
        p: (s) => clamp(0.5 - rv(s).gap * 0.06 + (s.cond - 70) / 200, 0.15, 0.85),
        ok: { text: '완승. 한 단계 올라선 느낌입니다. 경기 후 인터뷰에서 기자들이 당신 이름만 불렀습니다.', fx: (s) => { rv(s).gap -= 3; addAttr(s, bestKey(s), 1.5); addStat(s, 'fame', 6); addStat(s, 'morale', 8); advanceStory(s, 'rival', 2); schedule(s, 'rival-3', ri(4, 6)); } },
        fail: { text: byPos<string>({ FW: '라이벌이 결승골을 넣었습니다. 벤치로 걸어가는 길이 길게 느껴졌습니다.', MF: '중원 싸움에서 완패. 라이벌의 킬패스가 결승골로 이어졌습니다.', DF: '라이벌이 당신을 제치고 결승골을 넣었습니다. 하이라이트에 당신의 뒷모습이 남았습니다.', GK: '라이벌 골키퍼는 무실점, 당신은 두 골을 내줬습니다. 비교 기사가 쏟아집니다.' }), fx: (s) => { rv(s).gap += 2; addStat(s, 'morale', -8); advanceStory(s, 'rival', 2); schedule(s, 'rival-3', ri(4, 6)); } },
      },
      { label: '팀 전술에 충실한다', ok: { text: '개인 대결은 무승부. 감독은 당신의 판단을 높이 샀습니다.', fx: (s) => { addStat(s, 'trust', 1); advanceStory(s, 'rival', 2); schedule(s, 'rival-3', ri(4, 6)); } } },
    ],
  },
  {
    id: 'rival-3', story: 'rival', stage: 3, chain: true, title: '대표팀 한 자리', w: 0, cond: () => true,
    text: (s) => `대표팀 ${POS[s.pos].label} 자리는 하나. ${rv(s).gap <= 0 ? '이제는 당신이 한 발 앞서 있습니다.' : `아직은 ${rivalName(s)}이(가) 한 발 앞서 있습니다.`}`,
    choices: [
      {
        label: '끝까지 경쟁한다', p: (s) => clamp(0.45 - rv(s).gap * 0.12 + (s.cond - 60) / 300, 0.08, 0.9),
        ok: { text: '주전 조끼는 당신의 것이었습니다. 긴 경쟁의 끝에서 한 단계 더 성장했습니다.', fx: (s) => { addAttr(s, bestKey(s), 3); addStat(s, 'fame', 8); if (s.nat.debutYear) s.nat.caps += 2; s.flags.potBonus = (s.flags.potBonus ?? 0) + 1; endStory(s, 'rival', '끝내 넘어선 벽'); } },
        fail: { text: '이번에도 한 끗 차이. 하지만 그 한 끗이 당신을 계속 달리게 합니다.', fx: (s) => { addStat(s, 'morale', -8); addStat(s, 'trust', -1); addAttr(s, weakKey(s), 1); endStory(s, 'rival', '영원한 2인자'); } },
      },
      {
        label: '먼저 손을 내민다', p: (s) => clamp(0.55 + (s.morale - 60) * 0.006, 0.35, 0.75),
        ok: { text: '"너 덕분에 여기까지 왔다." 둘은 대표팀 룸메이트가 됐고, 함께 훈련하며 서로의 장점을 흡수했습니다.', fx: (s) => { addStat(s, 'morale', 8); addStat(s, 'trust', 1); addAttr(s, weakKey(s), 2); endStory(s, 'rival', '라이벌에서 동료로'); } },
        fail: { text: '내민 손은 어색하게 허공에 머물렀습니다. 경쟁을 피했다는 수군거림만 남았습니다.', fx: (s) => { addStat(s, 'morale', -4); addStat(s, 'fame', -3); endStory(s, 'rival', '어색한 휴전'); } },
      },
    ],
  },

  // ── 재활의 시간 ──
  {
    id: 'rehab-1', story: 'rehab', stage: 1, title: '장기 부상 진단', w: 6,
    cond: (s) => s.injury >= 6 && !storyActive(s, 'rehab'),
    text: (s) => `정밀 검사 결과가 나왔습니다. 최소 ${s.injury}경기 결장. 의료진은 두 가지 길을 제시합니다.`,
    choices: [
      { label: '수술을 받는다', ok: { text: '수술은 잘 끝났습니다. 복귀는 늦어지지만 재발 위험은 낮아졌습니다. 구단은 장기적인 결정을 반겼습니다.', fx: (s) => { startStory(s, 'rehab', { surgery: true }); s.injury += 2; addStat(s, 'trust', 1); addStat(s, 'morale', 3); schedule(s, 'rehab-2', 1); } } },
      {
        label: '보존 치료를 택한다', p: (s) => clamp(0.8 - (s.age - 20) * 0.03 - (s.injury - 6) * 0.04, 0.2, 0.85),
        ok: { text: '회복이 예상보다 빠릅니다.', fx: (s) => { startStory(s, 'rehab', { surgery: false }); s.injury = Math.max(2, s.injury - 4); schedule(s, 'rehab-2', 1); } },
        fail: { text: '통증이 가라앉지 않습니다. 결장 기간이 늘었습니다.', fx: (s) => { startStory(s, 'rehab', { surgery: false }); s.injury += 4; schedule(s, 'rehab-2', 1); } },
      },
    ],
  },
  {
    id: 'rehab-2', story: 'rehab', stage: 2, chain: true, title: '재활의 벽', w: 0, cond: () => true,
    text: (s) => `재활 센터의 하루하루가 길기만 합니다. 팀은 당신 없이 경기를 치르고 있습니다.${s.injury ? ` (남은 결장 ${s.injury}경기)` : ''}`,
    choices: [
      {
        label: '조기 복귀를 강행한다', p: (s) => clamp(((s.story.rehab as unknown as { surgery: boolean }).surgery ? 0.6 : 0.4) + (s.attrs.phy - 65) * 0.015 - (s.age - 26) * 0.02, 0.15, 0.85),
        ok: { text: '의료진의 예상을 깨고 훈련장에 돌아왔습니다.', fx: (s) => { s.injury = 0; addStat(s, 'trust', 1.5); addStat(s, 'morale', 5); advanceStory(s, 'rehab', 2); schedule(s, 'rehab-3', 1, 12); } },
        fail: { text: '너무 서둘렀습니다. 같은 부위가 다시 올라왔습니다.', fx: (s) => { s.injury += ri(3, 6); addStat(s, 'morale', -10); advanceStory(s, 'rehab', 2); schedule(s, 'rehab-3', 1, 12); } },
      },
      { label: '완벽하게 회복한 뒤 돌아간다', ok: { text: '재활 기간 동안 상체 웨이트까지 끝냈습니다. 몸이 이전보다 단단합니다.', fx: (s) => { addStat(s, 'cond', 20); addAttr(s, 'phy', 1); advanceStory(s, 'rehab', 2); schedule(s, 'rehab-3', 1, 12); } } },
    ],
  },
  {
    id: 'rehab-3', story: 'rehab', stage: 3, chain: true, title: '복귀전', w: 0, cond: (s) => s.injury === 0,
    text: () => '관중석에서 당신의 이름을 연호합니다. 부상 이후 첫 경기입니다.',
    choices: [
      {
        label: byPos<string>({ FW: '복귀골로 증명한다', MF: '복귀전 공격포인트로 증명한다', DF: '무실점 수비로 증명한다', GK: '클린시트로 증명한다' }),
        p: (s) => clamp(0.3 + ((s.pos === 'GK' ? s.attrs.def : s.attrs.sho) - 60) * 0.012, 0.15, 0.75),
        ok: { text: '그림 같은 복귀 무대. 현지 매체는 "더 강해져서 돌아왔다"고 썼습니다.', fx: (s) => { addStat(s, 'fame', 8); addStat(s, 'morale', 15); endStory(s, 'rehab', '더 강해져서 돌아왔다'); } },
        fail: { text: byPos<string>({ FW: '골은 없었지만, 다시 뛸 수 있다는 것만으로도 충분했습니다.', MF: '골은 없었지만, 다시 뛸 수 있다는 것만으로도 충분했습니다.', DF: '실점은 막지 못했지만, 다시 뛸 수 있다는 것만으로도 충분했습니다.', GK: '실점은 막지 못했지만, 다시 골문 앞에 섰다는 것만으로도 충분했습니다.' }), fx: (s) => { addStat(s, 'morale', 3); endStory(s, 'rehab', '조용한 복귀'); } },
      },
      { label: '천천히 감각을 되찾는다', ok: { text: '무리하지 않았습니다. 긴 터널의 끝이 보입니다.', fx: (s) => { addStat(s, 'morale', 8); addStat(s, 'cond', 10); endStory(s, 'rehab', '긴 터널을 지나'); } } },
    ],
  },

  // ── 스캔들 ──
  {
    id: 'scandal-2', story: 'scandal', stage: 2, chain: true, title: '스캔들 후폭풍', w: 0, cond: () => true,
    text: () => '새벽 사진 기사가 일주일째 포털 메인에 걸려 있습니다. 구단 홍보팀이 대응 방향을 묻습니다.',
    choices: [
      {
        label: '기자회견에서 공개 사과한다', p: (s) => clamp(0.55 + s.trust * 0.05, 0.3, 0.85),
        ok: { text: '진심 어린 사과에 여론이 조금씩 돌아서고 있습니다.', fx: (s) => { addStat(s, 'fame', -3); addStat(s, 'morale', 3); addStat(s, 'trust', 0.5); advanceStory(s, 'scandal', 2); schedule(s, 'scandal-3', ri(2, 3)); } },
        fail: { text: '사과문의 단어 하나가 문제가 되며 역풍이 불었습니다.', fx: (s) => { addStat(s, 'fame', -6); addStat(s, 'morale', -6); addStat(s, 'trust', -1); advanceStory(s, 'scandal', 2); schedule(s, 'scandal-3', ri(2, 3)); } },
      },
      {
        label: '침묵으로 버틴다', p: (s) => clamp(0.85 - s.fame / 120, 0.12, 0.8),
        ok: { text: '다른 뉴스에 묻혀 조용히 잊혀졌습니다. 구단도 조용한 처신을 반겼습니다.', fx: (s) => { addStat(s, 'morale', 4); addStat(s, 'trust', 1); endStory(s, 'scandal', '없던 일로'); } },
        fail: { text: '침묵이 인정으로 받아들여졌습니다. 구단도 등을 돌리기 시작합니다.', fx: (s) => { addStat(s, 'fame', -6); addStat(s, 'trust', -1.5); advanceStory(s, 'scandal', 2); schedule(s, 'scandal-3', ri(2, 3)); } },
      },
    ],
  },
  {
    id: 'scandal-3', story: 'scandal', stage: 3, chain: true, title: '명예 회복의 기회', w: 0, cond: () => true,
    text: () => '논란이 가라앉을 무렵, 소아암 환아 돕기 자선 경기 초청장이 도착했습니다.',
    choices: [
      { label: '자선 경기에 참가한다', ok: { text: '아이들과 찍은 사진 한 장이 모든 기사를 덮었습니다.', fx: (s) => { addStat(s, 'fame', 8); addStat(s, 'morale', 8); endStory(s, 'scandal', '진심은 통한다'); } } },
      {
        label: '경기력으로만 답한다', p: (s) => clamp(0.4 + (ovr(s) - s.club.str) * 0.04 + (s.morale - 60) / 200, 0.15, 0.85),
        ok: { text: '연속 공격 포인트. 이제 아무도 그 사진 얘기를 하지 않습니다.', fx: (s) => { addStat(s, 'fame', 6); addStat(s, 'trust', 2); endStory(s, 'scandal', '실력이 곧 해명'); } },
        fail: { text: '부진이 이어지자 "사생활 탓"이라는 꼬리표가 붙었습니다.', fx: (s) => { addStat(s, 'morale', -8); endStory(s, 'scandal', '지워지지 않는 꼬리표'); } },
      },
    ],
  },

  // ── 유럽의 꿈 ──
  {
    id: 'europe-2', story: 'europe', stage: 2, chain: true, title: '에이전트의 전화', w: 0, cond: () => true,
    text: (s) => `유럽 이적을 전문으로 하는 거물 에이전트가 연락해 왔습니다. 수수료는 ${fmtMoney(agentFee(s))}.`,
    choices: [
      { label: '에이전트와 계약한다', ok: { text: '"다음 이적시장, 기대해도 좋습니다." 유럽 구단 리스트가 도착했습니다.', fx: (s) => { addStat(s, 'money', -agentFee(s)); s.flags.agent = true; addStat(s, 'morale', 6); addStat(s, 'fame', 4); advanceStory(s, 'europe', 2); schedule(s, 'europe-3', 1, 20); } } },
      { label: '지금 팀에서 더 성장한다', ok: { text: (s) => (s.contract && s.contract.years >= 3 ? '꿈은 잠시 접어두었습니다. 구단은 당신의 충성심에 감동했습니다.' : '꿈은 잠시 접어두었습니다. 다만 계약 만료를 앞둔 터라 구단의 반응은 미지근합니다.'), fx: (s) => { addStat(s, 'trust', s.contract && s.contract.years >= 3 ? 2 : 0.5); addStat(s, 'morale', 2); advanceStory(s, 'europe', 2); schedule(s, 'europe-3', 1, 20); } } },
    ],
  },
  {
    id: 'europe-3', story: 'europe', stage: 3, chain: true, title: '낯선 땅에서', w: 0,
    cond: (s) => leagueOf(s.leagueId).tier >= 4 && s.phase <= 1, expireEnding: '이루지 못한 꿈',
    text: (s) => `${s.club.name}에서의 첫 시즌. 말도, 음식도, 날씨도 낯섭니다.`,
    choices: [
      {
        label: '현지 언어부터 배운다', p: (s) => clamp(0.85 - (s.age - 21) * 0.06, 0.25, 0.85),
        ok: { text: '세 달 만에 라커룸 농담을 알아듣기 시작했습니다.', fx: (s) => { addStat(s, 'trust', 2); addStat(s, 'morale', 6); endStory(s, 'europe', '완벽한 적응'); } },
        fail: { text: '어학원과 훈련을 병행하기엔 몸이 너무 지쳤습니다.', fx: (s) => { addStat(s, 'morale', -6); addStat(s, 'cond', -10); endStory(s, 'europe', '느린 적응'); } },
      },
      {
        label: '실력으로만 소통한다', p: (s) => clamp(0.5 + (ovr(s) - s.club.str) * 0.06 + (s.cond - 60) / 200, 0.15, 0.85),
        ok: { text: '공은 만국 공통어였습니다. 감독이 당신을 전술의 중심에 세웠고, 홈 팬들은 응원가를 만들었습니다.', fx: (s) => { addStat(s, 'fame', 6); addStat(s, 'trust', 2); addStat(s, 'morale', 6); endStory(s, 'europe', s.pos === 'GK' || s.pos === 'DF' ? '말보다 실력' : '말보다 골'); } },
        fail: { text: '고립감이 커져 갑니다. 밤마다 고향 음식이 생각납니다.', fx: (s) => { addStat(s, 'morale', -10); endStory(s, 'europe', '향수병'); } },
      },
    ],
  },

  // ── 감독과의 인연 ──
  {
    id: 'mentor-2', story: 'mentor', stage: 2, chain: true, title: '감독의 특별 과제', w: 0, cond: (s) => isPro(s),
    text: (s) => `감독이 따로 불렀습니다. "${weakKeyLabel(s)}이 부족해. 이것만 채우면 넌 더 큰 선수가 된다."`,
    choices: [
      {
        label: '새로운 역할을 받아들인다', p: (s) => clamp(0.9 - (s.age - 20) * 0.05, 0.25, 0.85),
        ok: { text: '약점이 무기가 되기 시작했습니다.', fx: (s) => { addAttr(s, weakKey(s), 3); addStat(s, 'trust', 1.5); advanceStory(s, 'mentor', 2); schedule(s, 'mentor-3', ri(4, 6)); } },
        fail: { text: '몸에 맞지 않는 옷 같았습니다. 그래도 감독은 기다려 주었습니다.', fx: (s) => { addStat(s, 'trust', -1); addStat(s, 'morale', -4); advanceStory(s, 'mentor', 2); schedule(s, 'mentor-3', ri(4, 6)); } },
      },
      { label: '내 스타일을 고수한다', ok: { text: '장점을 더 날카롭게 다듬었습니다. 감독은 말없이 고개를 끄덕였습니다.', fx: (s) => { addAttr(s, bestKey(s), 2); advanceStory(s, 'mentor', 2); schedule(s, 'mentor-3', ri(4, 6)); } } },
    ],
  },
  {
    id: 'mentor-3', story: 'mentor', stage: 3, chain: true, title: '은사의 이적', w: 0, cond: (s) => isPro(s),
    text: () => '당신을 키워 준 감독이 다른 팀 지휘봉을 잡게 됐습니다. 떠나기 전날 밤 전화가 왔습니다. "같이 가자."',
    choices: [
      { label: '은사를 따라간다', ok: { text: '다음 이적시장에서 은사의 새 팀이 정식 제의를 보낼 겁니다.', fx: (s) => { s.flags.coachOffer = true; addStat(s, 'morale', 6); addStat(s, 'trust', -0.5); endStory(s, 'mentor', '은사와 함께'); } } },
      { label: '남아서 팀을 지킨다', ok: { text: '새 감독이 오지만, 구단은 남아 준 당신에게 부주장 완장을 맡겼습니다. 팬들도 떠나지 않은 당신을 기억할 겁니다.', fx: (s) => { s.trust = Math.round((s.trust * 0.6 + 1) * 10) / 10; addStat(s, 'fame', 3); addStat(s, 'morale', 4); endStory(s, 'mentor', '홀로서기'); } } },
    ],
  },
];

function weakKeyLabel(s: GameState): string {
  return labelOf(s, weakKey(s));
}
