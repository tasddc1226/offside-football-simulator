// ───────── 포지션 전용 이벤트: 공격수 · 미드필더 · 수비수 · 골키퍼 ─────────
import { clamp } from './rng.js';
import { EVENTS } from './events-data.js';
import { addStat, addAttr, pkWin, leagueOf, roleOf } from './engine.js';
import { ovr } from './attributes.js';
import type { Pos } from './data.js';
import type { GameState } from './types.js';

const inGame = (s: GameState) => s.phase > 0 && s.injury === 0;
const posIs = (...p: Pos[]) => (s: GameState) => p.includes(s.pos);

EVENTS.push(
  // ── 공격수 ──
  {
    id: 'fw-drought', title: '골 가뭄', w: 3, cond: (s) => posIs('FW')(s) && s.phase >= 1 && s.season.apps >= 6 && s.season.goals <= s.season.apps * 0.2,
    text: (s) => `${s.season.apps}경기 ${s.season.goals}골. 스트라이커에게 골 가뭄만큼 무거운 말은 없습니다. 기자들이 "해결사 부재"를 묻기 시작합니다.`,
    choices: [
      {
        label: '매일 밤 슈팅 300개를 찬다', p: (s) => clamp(0.5 + (s.cond - 60) / 150, 0.3, 0.8),
        ok: { text: '다음 경기, 첫 슈팅이 골망을 흔들었습니다. 봇물이 터졌습니다.', fx: (s) => { addAttr(s, 'sho', 2); s.season.goals++; addStat(s, 'morale', 12); addStat(s, 'cond', -8); } },
        fail: { text: '연습장에선 들어가는데 경기장에선 골대를 맞습니다.', fx: (s) => { addAttr(s, 'sho', 1); addStat(s, 'cond', -10); addStat(s, 'morale', -4); } },
      },
      { label: '욕심을 버리고 동료를 살린다', ok: { text: '골 대신 도움이 쌓였습니다. 감독은 "이타적인 9번"이라고 칭찬했습니다.', fx: (s) => { s.season.assists++; addAttr(s, 'pas', 1); addStat(s, 'trust', 1.5); addStat(s, 'morale', 4); } } },
    ],
  },
  {
    id: 'fw-one-on-one', title: '골키퍼와 1대1', w: 3, cond: (s) => posIs('FW')(s) && inGame(s),
    text: () => '후반 40분, 0-0. 수비 뒷공간을 파고들자 골키퍼와 단둘이 남았습니다. 관중이 모두 일어섰습니다.',
    choices: [
      {
        label: '칩슛으로 넘긴다', p: (s) => clamp(0.35 + (s.attrs.sho - 62) * 0.012 + (s.attrs.dri - 60) * 0.006, 0.15, 0.75),
        ok: { text: '공이 골키퍼 머리 위를 부드럽게 넘어 골문에 떨어졌습니다. 결승골!', fx: (s) => { s.season.goals++; pkWin(s); addStat(s, 'fame', 7); addStat(s, 'morale', 10); } },
        fail: { text: '골키퍼가 끝까지 서 있었습니다. 칩슛이 품에 안겼습니다.', fx: (s) => { addStat(s, 'morale', -8); addStat(s, 'fame', -1); } },
      },
      {
        label: '골키퍼를 제치고 빈 골대에 넣는다', p: (s) => clamp(0.4 + (s.attrs.dri - 62) * 0.014, 0.15, 0.8),
        ok: { text: '침착하게 제치고 빈 골대에 밀어 넣었습니다. 결승골!', fx: (s) => { s.season.goals++; pkWin(s); addStat(s, 'fame', 5); addStat(s, 'morale', 10); } },
        fail: { text: '너무 길게 쳤습니다. 공이 엔드라인을 넘어갔습니다.', fx: (s) => addStat(s, 'morale', -7) },
      },
    ],
  },
  {
    id: 'fw-target', title: '타깃형 스트라이커 전환', w: 2, cond: (s) => posIs('FW')(s) && s.phase <= 1 && s.type !== 'target' && !isAmateur(s),
    text: () => '감독이 전술판을 가리킵니다. "이번 시즌엔 네가 최전방에서 등지고 버텨줘야 한다. 몸싸움을 늘려라."',
    choices: [
      {
        label: '웨이트를 늘려 받아들인다', p: (s) => clamp(0.3 + (s.attrs.phy - 55) * 0.025, 0.15, 0.9),
        ok: { text: '상체가 두꺼워졌습니다. 센터백과의 몸싸움이 두렵지 않습니다.', fx: (s) => { addAttr(s, 'phy', 3); addAttr(s, 'pac', -1); addStat(s, 'trust', 1.5); } },
        fail: { text: '늘어난 체중에 몸이 무거워졌습니다. 장점이던 스피드마저 무뎌졌습니다.', fx: (s) => { addAttr(s, 'phy', 1); addAttr(s, 'pac', -2); addStat(s, 'morale', -4); } },
      },
      {
        label: '뒷공간 침투가 내 무기라고 설득한다', p: (s) => clamp(0.25 + s.trust * 0.06 + (s.attrs.pac - 65) * 0.025, 0.1, 0.85),
        ok: { text: '감독이 한발 물러섰습니다. 당신에게 맞춘 역습 전술이 생겼습니다.', fx: (s) => { addAttr(s, 'pac', 1.5); addStat(s, 'morale', 6); addStat(s, 'trust', 1); } },
        fail: { text: '"그럼 벤치에서 보자." 대화는 짧게 끝났습니다.', fx: (s) => { addStat(s, 'trust', -2); addStat(s, 'morale', -5); } },
      },
    ],
  },

  // ── 미드필더 ──
  {
    id: 'mf-freekick', title: '프리킥 전담 키커', w: 3, cond: (s) => posIs('MF')(s) && inGame(s),
    text: () => '페널티 박스 바로 앞, 좋은 위치에서 프리킥. 전담 키커 자리를 두고 베테랑 선배와 눈이 마주쳤습니다.',
    choices: [
      {
        label: '직접 감아 찬다', p: (s) => clamp(0.22 + (s.attrs.sho - 60) * 0.008 + (s.attrs.pas - 60) * 0.008, 0.1, 0.55),
        ok: { text: '벽을 넘어 골대 구석에 꽂힌 환상적인 프리킥! 이제 전담 키커는 당신입니다.', fx: (s) => { s.season.goals++; addStat(s, 'fame', 6); addStat(s, 'trust', 1); addStat(s, 'morale', 8); } },
        fail: { text: '벽에 맞고 나왔습니다. 선배가 어깨를 두드립니다.', fx: (s) => addStat(s, 'morale', -3) },
      },
      {
        label: '짧게 내주는 약속된 플레이', p: (s) => clamp(0.3 + (s.attrs.pas - 60) * 0.012, 0.15, 0.7),
        ok: { text: '훈련장에서 수십 번 맞춘 세트피스가 그대로 골로 이어졌습니다. 어시스트!', fx: (s) => { s.season.assists++; addStat(s, 'trust', 1.5); addStat(s, 'morale', 5); } },
        fail: { text: '타이밍이 어긋나 공을 뺏겼습니다.', fx: (s) => addStat(s, 'trust', -0.5) },
      },
    ],
  },
  {
    id: 'mf-role', title: '수비형 미드필더 전환 제안', w: 2, cond: (s) => posIs('MF')(s) && !isAmateur(s) && s.phase <= 1,
    text: () => '주전 6번이 장기 부상으로 이탈했습니다. 감독이 당신에게 한 칸 아래로 내려가 달라고 부탁합니다.',
    choices: [
      {
        label: '팀을 위해 받아들인다', p: (s) => clamp(0.35 + (s.attrs.def - 60) * 0.025, 0.15, 0.9),
        ok: { text: '볼 탈취와 전개를 동시에 해냈습니다. "중원의 청소부"라는 별명이 붙었습니다.', fx: (s) => { addAttr(s, 'def', 3); addAttr(s, 'pas', 1); addStat(s, 'trust', 2); } },
        fail: { text: '수비 위치 선정이 어색했습니다. 뒷공간을 연달아 내주며 공격 리듬까지 잃었습니다.', fx: (s) => { addAttr(s, 'def', 1); addStat(s, 'morale', -6); addStat(s, 'trust', -0.5); } },
      },
      {
        label: '공격형 역할을 고집한다', p: (s) => clamp(0.45 + (ovrOf(s) - s.club.str) * 0.07 + s.trust * 0.04, 0.1, 0.9),
        ok: { text: '감독이 결국 다른 대안을 찾았습니다. "그래, 넌 앞에서 해결해라." 공격형 자리에서 더 과감해졌습니다.', fx: (s) => { addAttr(s, 'sho', 1.5); addAttr(s, 'dri', 1); addStat(s, 'morale', 5); addStat(s, 'fame', 3); addStat(s, 'trust', 1); } },
        fail: { text: '당신 자리는 지켰지만, 감독의 표정이 굳었습니다.', fx: (s) => { addStat(s, 'trust', -1.5); addStat(s, 'morale', -3); } },
      },
    ],
  },
  {
    id: 'mf-press', title: '강도 높은 전방 압박', w: 2, cond: (s) => posIs('MF')(s) && inGame(s),
    text: () => '새 전술은 "게겐프레싱"입니다. 미드필더는 경기당 13km를 뛰어야 합니다. 3경기째 다리가 무겁습니다.',
    choices: [
      {
        label: '끝까지 압박 강도를 유지한다', p: (s) => clamp(0.4 + (s.attrs.phy - 60) * 0.015 + (s.cond - 60) / 200, 0.2, 0.85),
        ok: { text: '상대 빌드업을 끊고 그대로 결정적 패스까지 이어갔습니다. 활동량 1위!', fx: (s) => { s.season.assists++; addAttr(s, 'phy', 1.5); addStat(s, 'trust', 1.5); addStat(s, 'cond', -12); } },
        fail: { text: '후반 20분, 다리에 쥐가 났습니다. 교체 아웃.', fx: (s) => { addStat(s, 'cond', -18); s.injury = Math.max(s.injury, 1); } },
      },
      {
        label: '영리하게 압박 타이밍을 고른다', p: (s) => clamp(0.4 + (s.attrs.pas - 60) * 0.012, 0.2, 0.8),
        ok: { text: '뛰는 거리는 줄었지만 볼 탈취는 늘었습니다. 코치가 데이터를 보고 감탄합니다.', fx: (s) => { addAttr(s, 'def', 1); addStat(s, 'trust', 1); } },
        fail: { text: '"압박 안 하는 선수는 못 쓴다." 감독의 불호령이 떨어졌습니다.', fx: (s) => addStat(s, 'trust', -1.5) },
      },
    ],
  },

  // ── 수비수 ──
  {
    id: 'df-marking', title: '득점 1위 전담 마크', w: 3, cond: (s) => posIs('DF')(s) && inGame(s),
    text: () => '이번 상대는 리그 득점 1위 공격수를 보유한 팀입니다. 감독이 말합니다. "90분 동안 그림자처럼 붙어라."',
    choices: [
      {
        label: '타이트하게 대인 마크한다', p: (s) => clamp(0.4 + (s.attrs.def - 62) * 0.014 + (s.attrs.pac - 60) * 0.006, 0.15, 0.85),
        ok: { text: '득점 1위를 슈팅 0개로 묶었습니다. 무실점 승리!', fx: (s) => { s.season.cs++; pkWin(s); addStat(s, 'fame', 5); addStat(s, 'trust', 2); addStat(s, 'morale', 8); } },
        fail: { text: '한순간 등을 내줬습니다. 그 한 번에 실점했습니다.', fx: (s) => { addStat(s, 'morale', -8); addStat(s, 'trust', -1); } },
      },
      {
        label: '지역 방어로 공간을 지운다', p: (s) => clamp(0.45 + (s.attrs.def - 62) * 0.01, 0.2, 0.8),
        ok: { text: '공간을 먼저 차지하자 상대 에이스가 고립됐습니다.', fx: (s) => { s.season.cs++; addStat(s, 'trust', 1); } },
        fail: { text: '라인 사이로 스루패스가 들어왔습니다. 실점.', fx: (s) => addStat(s, 'morale', -5) },
      },
    ],
  },
  {
    id: 'df-lastman', title: '최후방 수비수의 선택', w: 2, cond: (s) => posIs('DF')(s) && inGame(s),
    text: () => '역습 상황, 당신이 마지막 수비수입니다. 상대 윙어가 전속력으로 달려옵니다. 태클이 늦으면 퇴장입니다.',
    choices: [
      {
        label: '슬라이딩 태클로 끊는다', p: (s) => clamp(0.4 + (s.attrs.def - 62) * 0.012 + (s.attrs.pac - 60) * 0.008, 0.15, 0.8),
        ok: { text: '공만 정확히 걷어냈습니다. 홈 관중이 골을 넣은 것처럼 환호합니다.', fx: (s) => { addStat(s, 'fame', 4); addStat(s, 'morale', 7); addStat(s, 'trust', 1); } },
        fail: { text: '발목을 걸었습니다. 레드카드. 팀은 10명으로 싸워야 했고, 징계위원회가 기다립니다.', fx: (s) => { addStat(s, 'trust', -2); addStat(s, 'morale', -8); addStat(s, 'fame', -2); } },
      },
      {
        label: '버티며 지연 수비한다', p: (s) => clamp(0.4 + (s.attrs.pac - 66) * 0.02, 0.15, 0.9),
        ok: { text: '동료가 복귀할 시간을 벌었습니다. 위기 탈출.', fx: (s) => addStat(s, 'trust', 1.5) },
        fail: { text: '속도에서 밀렸습니다. 골키퍼와 1대1을 내줬습니다.', fx: (s) => { addStat(s, 'morale', -5); addAttr(s, 'pac', 0.5); } },
      },
    ],
  },
  {
    id: 'df-header', title: '코너킥 공격 가담', w: 2, cond: (s) => posIs('DF')(s) && inGame(s),
    text: () => '1-1로 맞선 후반 막판 코너킥. 감독이 센터백들에게 모두 올라가라고 손짓합니다.',
    choices: [
      {
        label: '니어포스트로 달려든다', p: (s) => clamp(0.2 + (s.attrs.phy - 60) * 0.012, 0.08, 0.5),
        ok: { text: '머리에 정확히 맞았습니다. 수비수의 극장 헤더 결승골!', fx: (s) => { s.season.goals++; pkWin(s); addStat(s, 'fame', 6); addStat(s, 'morale', 10); } },
        fail: { text: '한 뼘 차이로 빗나갔습니다. 급히 수비 진영으로 뛰어 돌아갑니다.', fx: (s) => addStat(s, 'cond', -4) },
      },
      { label: '역습 대비로 남는다', ok: { text: '냉정한 판단. 상대 역습을 커트했습니다.', fx: (s) => addStat(s, 'trust', 1) } },
    ],
  },
  {
    id: 'df-overlap', title: '풀백의 오버래핑', w: 2, cond: (s) => posIs('DF')(s) && inGame(s) && (s.type === 'fullback' || s.attrs.pac >= 65),
    text: () => '측면이 비었습니다. 윙어가 안쪽으로 파고들며 당신에게 오버래핑 공간을 만들어 줬습니다.',
    choices: [
      {
        label: '끝까지 올라가 크로스를 올린다', p: (s) => clamp(0.3 + (s.attrs.pas - 58) * 0.012 + (s.attrs.pac - 60) * 0.006, 0.12, 0.7),
        ok: { text: '자로 잰 듯한 크로스가 공격수 머리에 떨어졌습니다. 어시스트!', fx: (s) => { s.season.assists++; addStat(s, 'fame', 3); addStat(s, 'trust', 1); addStat(s, 'morale', 5); addStat(s, 'cond', -6); } },
        fail: { text: '크로스가 끊겼고 비워둔 뒷공간으로 역습을 맞았습니다.', fx: (s) => { addStat(s, 'trust', -1); addStat(s, 'cond', -6); } },
      },
      { label: '수비 밸런스를 지킨다', ok: { text: '무리하지 않았습니다. 감독은 안정감을 높이 삽니다.', fx: (s) => { addStat(s, 'trust', 0.8); addStat(s, 'cond', 4); } } },
    ],
  },

  // ── 골키퍼 ──
  {
    id: 'gk-error', title: '치명적인 실수', w: 2, cond: (s) => posIs('GK')(s) && s.phase > 0,
    text: () => '평범한 백패스 처리 도중 공이 발밑을 빠져나가 그대로 골문으로 굴러 들어갔습니다. 실수 장면이 전 세계로 퍼지고 있습니다.',
    choices: [
      {
        label: '다음 경기에 바로 나선다', p: (s) => clamp(0.45 + (s.morale - 50) / 150 + (s.attrs.dri - 55) * 0.008, 0.2, 0.85),
        ok: { text: '다음 경기 선방 7개, 무실점. 실수를 실력으로 덮었습니다.', fx: (s) => { s.season.cs++; addStat(s, 'morale', 10); addStat(s, 'trust', 1.5); addStat(s, 'fame', 3); } },
        fail: { text: '흔들린 마음이 다시 실수를 불렀습니다. 벤치로 밀려났습니다.', fx: (s) => { addStat(s, 'trust', -2.5); addStat(s, 'morale', -10); } },
      },
      { label: '감독에게 한 경기 휴식을 요청한다', ok: { text: '한 경기 쉬며 멘탈을 정리했습니다. 넘버원 자리는 조금 흔들립니다.', fx: (s) => { addStat(s, 'morale', 6); addStat(s, 'trust', -1); } } },
    ],
  },
  {
    id: 'gk-sweeper', title: '스위퍼 키퍼 요구', w: 2, cond: (s) => posIs('GK')(s) && !isAmateur(s) && s.phase <= 1,
    text: () => '새 감독은 후방 빌드업을 중시합니다. "골키퍼가 11번째 필드 플레이어가 돼야 한다. 발밑을 키워라."',
    choices: [
      {
        label: '필드 플레이어와 패스 훈련을 한다', p: (s) => clamp(0.3 + (s.attrs.pas - 60) * 0.025, 0.12, 0.9),
        ok: { text: '압박 속에서도 짧은 패스로 풀어나옵니다. 감독이 만족합니다.', fx: (s) => { addAttr(s, 'pas', 3); addAttr(s, 'dri', 1); addStat(s, 'trust', 2); } },
        fail: { text: '패스 미스가 잦아 전술 훈련에서 여러 번 실점했습니다.', fx: (s) => { addAttr(s, 'pas', 1); addStat(s, 'trust', -1); addStat(s, 'morale', -4); } },
      },
      { label: '골키퍼는 막는 게 먼저라고 말한다', ok: { text: '선방에 집중했습니다. 감독과의 거리는 조금 멀어졌지만, 선방 능력만큼은 한 단계 올라섰습니다.', fx: (s) => { addAttr(s, 'def', 2); addStat(s, 'trust', -0.5); } } },
    ],
  },
  {
    id: 'gk-pk', title: '페널티킥 선언', w: 2, cond: (s) => posIs('GK')(s) && inGame(s),
    text: () => '후반 추가시간, 1-0으로 앞선 상황에서 페널티킥이 선언됐습니다. 상대 키커가 공을 내려놓고 당신을 쳐다봅니다.',
    choices: [
      {
        label: '키커의 습관을 분석한 대로 뛴다', p: (s) => clamp(0.25 + (s.attrs.def - 62) * 0.01 + (s.attrs.dri - 55) * 0.006, 0.12, 0.55),
        ok: { text: '막았습니다! 승리를 지켜낸 선방. 동료들이 당신을 덮칩니다.', fx: (s) => { s.season.cs++; addStat(s, 'fame', 7); addStat(s, 'morale', 12); addStat(s, 'trust', 1.5); } },
        fail: { text: '방향은 맞았지만 손끝을 스쳤습니다. 1-1 무승부.', fx: (s) => { const S = s.season; if (S.w > 0) { S.w--; S.d++; S.pts -= 2; } addStat(s, 'morale', -5); } },
      },
      {
        label: '골라인에서 심리전을 건다', p: (s) => clamp(0.2 + (s.fame - 20) * 0.004 + (s.attrs.phy - 55) * 0.006, 0.1, 0.45),
        ok: { text: '당신의 몸짓에 키커가 흔들렸습니다. 슈팅이 하늘로 날아갑니다!', fx: (s) => { s.season.cs++; addStat(s, 'fame', 6); addStat(s, 'morale', 10); } },
        fail: { text: '침착한 키커였습니다. 1-1 무승부.', fx: (s) => { const S = s.season; if (S.w > 0) { S.w--; S.d++; S.pts -= 2; } addStat(s, 'morale', -4); } },
      },
    ],
  },
  {
    id: 'gk-no1', title: '넘버원 경쟁', w: 2, cond: (s) => posIs('GK')(s) && !isAmateur(s) && s.phase <= 1 && roleOfRef(s) !== '주전',
    text: () => '골키퍼는 한 명만 뛸 수 있는 포지션입니다. 구단이 경쟁자에게 넘버원 장갑을 맡기려 한다는 이야기가 들립니다.',
    choices: [
      {
        label: '훈련 세이브율로 증명한다', p: (s) => clamp(0.35 + (ovrOf(s) - s.club.str) * 0.04, 0.1, 0.8),
        ok: { text: '골키퍼 코치의 보고서가 감독의 마음을 돌렸습니다. 다음 경기 선발입니다.', fx: (s) => { addStat(s, 'trust', 3); addStat(s, 'morale', 8); } },
        fail: { text: '경쟁자가 먼저 기회를 잡았습니다. 당분간 컵 대회 출전에 만족해야 합니다.', fx: (s) => addStat(s, 'morale', -6) },
      },
      { label: '경쟁자와 함께 성장하기로 한다', ok: { text: '서로 슈팅을 막아주며 둘 다 성장했습니다.', fx: (s) => { addAttr(s, 'def', 1.5); addStat(s, 'morale', 3); } } },
    ],
  },
  {
    id: 'gk-cross', title: '공중볼 장악', w: 2, cond: (s) => posIs('GK')(s) && inGame(s),
    text: () => '상대가 장신 공격수를 투입하고 크로스를 계속 올립니다. 골문 앞이 혼전입니다.',
    choices: [
      {
        label: '과감하게 나와서 펀칭한다', p: (s) => clamp(0.4 + (s.attrs.phy - 58) * 0.014, 0.15, 0.85),
        ok: { text: '공중볼을 전부 지배했습니다. 상대 감독이 크로스 전술을 포기했습니다.', fx: (s) => { s.season.cs++; addStat(s, 'trust', 1.5); addAttr(s, 'phy', 0.8); } },
        fail: { text: '나왔다가 공을 놓쳤습니다. 빈 골대에 헤더 실점.', fx: (s) => { addStat(s, 'morale', -7); addStat(s, 'trust', -1); } },
      },
      {
        label: '골라인을 지키며 수비수를 지휘한다', p: (s) => clamp(0.45 + (s.attrs.dri - 55) * 0.01, 0.2, 0.8),
        ok: { text: '쉴 새 없는 콜 플레이로 수비 라인을 정리했습니다. 무실점.', fx: (s) => { s.season.cs++; addStat(s, 'trust', 1); } },
        fail: { text: '골문 앞 혼전 끝에 실점했습니다.', fx: (s) => addStat(s, 'morale', -4) },
      },
    ],
  },
);

function isAmateur(s: GameState): boolean {
  return !!leagueOf(s.leagueId).amateur;
}
function ovrOf(s: GameState): number {
  return ovr(s);
}
function roleOfRef(s: GameState): string {
  return roleOf(s);
}
